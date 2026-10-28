export async function removeLegacyOrderNumberIndex(database, collectionName) {
  const collections = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .toArray();
  if (!collections.length) return false;

  const collection = database.collection(collectionName);
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find(
    (index) => index.name === "orderNumber_1"
      && index.key?.orderNumber === 1
      && index.unique === true
  );
  if (!legacyIndex) return false;

  try {
    await collection.dropIndex(legacyIndex.name);
    return true;
  } catch (error) {
    if (error.code === 27 || error.codeName === "IndexNotFound") return false;
    throw error;
  }
}
