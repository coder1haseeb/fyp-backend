const storeId = item => String(item.product?.business?._id || item.product?.business || '');

function selectStoreItems(items, businessId) {
  const stores = new Set(items.map(storeId).filter(Boolean));
  const selected = businessId || (stores.size === 1 ? [...stores][0] : '');
  if (!selected) return { error: 'Select one store from your cart before checkout.' };
  const selectedItems = items.filter(item => storeId(item) === String(selected));
  if (!selectedItems.length) return { error: 'The selected store has no items in your cart.' };
  return { items: selectedItems, businessId: String(selected) };
}

module.exports = { selectStoreItems };
