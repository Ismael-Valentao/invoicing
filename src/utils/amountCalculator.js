const normalizeNumber = (value) => {
  if (typeof value === "string") {
    // Se for formato europeu (2.500,5) → vira 2500.5
    if (value.includes(",") && value.includes(".")) {
      // remove separador de milhares "." e troca "," por "."
      value = value.replace(/\,/g, "");
    } else {
      // caso en-US (2,500.5) → vira 2500.5
      value = value.replace(/,/g, "");
    }
  }
  return Number(value);
};

const normalizeItems = (items) => {
  return items.map(item => ({
    ...item,
    quantity: normalizeNumber(item.quantity),
    unitPrice: normalizeNumber(item.unitPrice),
  }));
};

const amounts = (items, taxRate = 0.16) => {
  let subTotal = 0;

  items.forEach(item => {
    const quantity = normalizeNumber(item.quantity);
    const unitPrice = normalizeNumber(item.unitPrice);
    const itemTotal = quantity * unitPrice;
    subTotal += itemTotal;
  });

  const tax = subTotal * taxRate;
  const totalAmount = subTotal + tax;

  return {
    subTotal: Number(subTotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2))
  };
};

module.exports = { amounts, normalizeItems };
