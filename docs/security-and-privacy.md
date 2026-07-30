# Security and privacy

Tabiya is local-first: catalog data is bundled; repertoire choices, SRS, events, imported games, preparation events, and local analysis live in the browser. Clearing browser site data removes them.

Optional game sync contacts Lichess or Chess.com. Optional AI narration sends the selected position/context to the chosen provider; Ollama uses its configured local endpoint; WebLLM requires an explicit model download. Remembered provider keys and Lichess tokens are sensitive browser data. Browser storage is accessible to JavaScript on the same origin, so it depends on application and XSS security.

Production headers enforce COOP/COEP/CORP, nosniff, referrer policy, framing protection, permissions policy, and a narrow CSP. No analytics or error-tracking service is configured. External links should use expected HTTPS provider hosts and `noopener noreferrer`.
