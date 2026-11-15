const SEARCH_FIELDS = [
  "title",
  "sku",
  "description",
  "type",
  "fabric",
  "fit",
  "occasion",
  "categories",
  "sizes",
  "colors.name",
];

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getSearchTerms(value) {
  return normalizeSearchText(value).match(/[a-z0-9]+/g) || [];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildProductSearchQuery(value) {
  const terms = getSearchTerms(value);
  if (!terms.length) return null;

  return {
    $or: terms.flatMap((term) => {
      const expression = new RegExp(escapeRegex(term), "i");
      return SEARCH_FIELDS.map((field) => ({ [field]: expression }));
    }),
  };
}

function editDistance(left, right, maxDistance) {
  if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
  const matrix = Array.from(
    { length: left.length + 1 },
    () => Array(right.length + 1).fill(0)
  );
  for (let row = 0; row <= left.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= right.length; column += 1) matrix[0][column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row][column - 1] + 1,
        matrix[row - 1][column] + 1,
        matrix[row - 1][column - 1] + cost
      );
      if (
        row > 1
        && column > 1
        && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]
      ) {
        matrix[row][column] = Math.min(matrix[row][column], matrix[row - 2][column - 2] + 1);
      }
    }
  }

  return matrix[left.length][right.length] <= maxDistance
    ? matrix[left.length][right.length]
    : maxDistance + 1;
}

function productSearchData(product) {
  const values = SEARCH_FIELDS.flatMap((field) => {
    let currentValues = [product];
    for (const key of field.split(".")) {
      currentValues = currentValues.flatMap((current) => {
        const value = current?.[key];
        return Array.isArray(value) ? value : [value];
      });
    }
    return currentValues;
  });
  const text = normalizeSearchText(values.filter(Boolean).join(" "));
  return { text, terms: getSearchTerms(text) };
}

function termScore(queryTerm, productTerms) {
  let best = 0;
  for (const productTerm of productTerms) {
    if (productTerm === queryTerm) return 100;
    if (productTerm.startsWith(queryTerm)) best = Math.max(best, 75);
    else if (queryTerm.length >= 4 && queryTerm.startsWith(productTerm)) best = Math.max(best, 60);
    else if (queryTerm.length >= 4) {
      const maxDistance = queryTerm.length >= 8 ? 2 : 1;
      const distance = editDistance(queryTerm, productTerm, maxDistance);
      if (distance <= maxDistance) best = Math.max(best, 50 - distance * 10);
    }
  }
  return best;
}

export function rankProductsBySearch(products, query) {
  const queryText = normalizeSearchText(query).trim();
  const queryTerms = getSearchTerms(query);
  if (!queryTerms.length) return [];

  return products
    .map((product) => {
      const { text, terms } = productSearchData(product);
      const termScores = queryTerms.map((term) => termScore(term, terms));
      const matchedTerms = termScores.filter(Boolean).length;
      const phraseMatch = text.includes(queryText);
      return {
        product,
        matchedTerms,
        score: termScores.reduce((total, score) => total + score, 0) + (phraseMatch ? 50 : 0),
      };
    })
    .filter((match) => match.matchedTerms >= Math.ceil(queryTerms.length * 0.6))
    .sort((left, right) =>
      right.matchedTerms - left.matchedTerms
      || right.score - left.score
      || new Date(right.product.createdAt || 0) - new Date(left.product.createdAt || 0)
    )
    .map(({ product }) => product);
}
