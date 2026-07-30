"""Download and parse the lichess-org/chess-openings TSV files.

The upstream TSV files are organized a.tsv .. e.tsv by ECO letter. Each row is
   eco<TAB>name<TAB>pgn

We cache the raw files under scripts/.cache/openings-tsv/ and parse them on
every run. Parsing converts the PGN into a list of SAN moves using python-chess
to canonicalize notation.

Constitution Article 9 — moves stored as SAN.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import chess.pgn
import httpx

import chess

logger = logging.getLogger(__name__)

TSV_LETTERS = ("a", "b", "c", "d", "e")
TSV_BASE_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master/{letter}.tsv"
USER_AGENT = "tabiya-build/0.1 (+https://github.com/Agrek11/tabiya)"


@dataclass(frozen=True)
class TsvRow:
    """One row from the upstream TSV — a named opening with its naming sequence."""

    eco: str
    name: str
    pgn: str
    san_moves: tuple[str, ...]


def download_tsv(letter: str, cache_dir: Path, refresh: bool = False) -> Path:
    """Fetch a single TSV file (cached). Returns the local cache path.

    Raises httpx.HTTPError on download failure when no cache exists.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    target = cache_dir / f"{letter}.tsv"
    if target.exists() and not refresh:
        logger.debug("TSV cache hit: %s", target)
        return target

    url = TSV_BASE_URL.format(letter=letter)
    logger.info("Fetching %s", url)
    with httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
        resp = client.get(url)
        resp.raise_for_status()
        target.write_text(resp.text, encoding="utf-8")
    return target


def download_all(cache_dir: Path, refresh: bool = False) -> list[Path]:
    """Fetch all 5 TSV files; returns paths in a-e order."""
    return [download_tsv(letter, cache_dir, refresh=refresh) for letter in TSV_LETTERS]


def _pgn_to_san_tuple(pgn: str) -> tuple[str, ...]:
    """Parse a PGN move sequence (no headers) into a tuple of canonical SAN strings."""
    board = chess.Board()
    moves: list[str] = []
    # Strip move numbers like "1." "2..." and trailing text.
    tokens = [t for t in pgn.replace("\n", " ").split() if t]
    for tok in tokens:
        # Skip move numbers ("1.", "2...", "12.") and result markers
        if tok[0].isdigit() and ("." in tok):
            continue
        if tok in {"1-0", "0-1", "1/2-1/2", "*"}:
            break
        try:
            move = board.parse_san(tok)
        except (ValueError, chess.IllegalMoveError, chess.AmbiguousMoveError):
            logger.warning("Could not parse SAN token %r in pgn %r", tok, pgn)
            continue
        moves.append(board.san(move))
        board.push(move)
    return tuple(moves)


def parse_tsv(path: Path) -> list[TsvRow]:
    """Parse a downloaded TSV file into a list of TsvRow.

    The lichess TSV format is:
        eco<TAB>name<TAB>pgn
    First line is a header; we skip lines that don't have exactly 3 tab fields.
    """
    rows: list[TsvRow] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        if not raw_line or raw_line.startswith("#"):
            continue
        parts = raw_line.split("\t")
        if len(parts) != 3:
            continue
        eco, name, pgn = parts
        if eco == "eco":  # header row
            continue
        san = _pgn_to_san_tuple(pgn)
        rows.append(TsvRow(eco=eco, name=name, pgn=pgn, san_moves=san))
    return rows


def parse_all(paths: list[Path]) -> list[TsvRow]:
    """Parse all TSV files and concatenate the rows."""
    out: list[TsvRow] = []
    for p in paths:
        out.extend(parse_tsv(p))
    return out
