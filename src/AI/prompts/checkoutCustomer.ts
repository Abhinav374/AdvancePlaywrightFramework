export const checkoutCustomerPrompt = `
Generate one fictional customer for automated checkout testing.
Return a JSON object with exactly these string fields:
- firstName
- lastName
- postalCode

Use a plausible fictional name and a valid US ZIP code. Do not use personal
information about a real person. Return JSON only, without markdown or explanation.
`.trim();
