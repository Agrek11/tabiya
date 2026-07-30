import { getRepository } from '../../storage';

export type OpeningKgNode = {
  lineId: string;
  openingId: string;
  openingName: string;
  familyId: string;
  familyName: string | null;
  variationId: string | null;
  variationName: string | null;
  tags: string[];
};

export async function lookupKgNode(lineId: string | undefined): Promise<OpeningKgNode | null> {
  if (!lineId) return null;
  const repo = getRepository();
  const line = await repo.getLine(lineId);
  if (!line) return null;
  const opening = await repo.getOpening(line.opening_id);
  if (!opening) return null;
  const family = await repo.getFamily(opening.family_id);
  const variation = line.variation_id ? await repo.getVariation(line.variation_id) : null;
  return {
    lineId: line.id,
    openingId: opening.id,
    openingName: opening.name,
    familyId: opening.family_id,
    familyName: family?.name ?? null,
    variationId: line.variation_id ?? null,
    variationName: variation?.name ?? null,
    tags: [...line.tags].sort(),
  };
}

export function renderKgBlock(node: OpeningKgNode | null): string {
  if (!node) return '(none)';
  const parts = [
    `opening: ${node.openingName}`,
    node.familyName ? `family: ${node.familyName}` : null,
    node.variationName ? `variation: ${node.variationName}` : null,
    node.tags.length > 0 ? `line-tags: ${node.tags.join(', ')}` : null,
  ].filter((x): x is string => Boolean(x));
  return parts.join('\n');
}
