import * as cheerio from 'cheerio';

/**
 * Parses Sefaz-SP NFC-e HTML and extracts fueling data.
 * @param {string} htmlString - The raw HTML content from the Sefaz URL.
 * @returns {Object} Structured data object.
 */
export function parseFuelReceipt(htmlString) {
  const $ = cheerio.load(htmlString);

  // Helper to clean numeric strings (38,449 -> 38.449)
  const parseBrazilianFloat = (val) => {
    if (!val) return 0;
    const clean = val.replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  // 1. Basic Metadata
  const gasStationName = $('#u20').text().trim();
  const product = $('#tabResult .txtTit').first().text().trim();
  
  // 2. Values and Quantities
  const quantityRaw = $('.Rqtd').text().replace('Qtde.:', '').trim();
  const unitPriceRaw = $('.RvlUnit').text().replace('Vl. Unit.:', '').trim();
  const totalValue = parseBrazilianFloat($('.valor').first().text());

  // 3. Extraction of Emission Date
  const emissionText = $('li:contains("Emissão:")').text();
  const dateMatch = emissionText.match(/Emissão:\s*(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2})/);
  const emissionDate = dateMatch ? dateMatch[1] : null;

  // 4. Fleet Data (Regex over the "Informações de interesse do contribuinte" block)
  const rawExtraInfo = $('h4:contains("Informações de interesse do contribuinte")')
    .next('.ui-collapsible-content')
    .text()
    .trim();

  // Regex patterns for Brazilian standards
  const plateMatch = rawExtraInfo.match(/PLACA:\s*([A-Z]{3}-?\d[A-Z\d]\d{2})/i);
  const kmMatch = rawExtraInfo.match(/KM:\s*(\d+)/i);
  const driverMatch = rawExtraInfo.match(/MOTORISTA:\s*([^.]+)/i);

  return {
    issuer: {
      name: gasStationName,
      cnpj: $('.text:contains("CNPJ")').text().replace('CNPJ:', '').trim()
    },
    transaction: {
      product: product,
      quantity: parseBrazilianFloat(quantityRaw),
      unitPrice: parseBrazilianFloat(unitPriceRaw),
      totalValue: totalValue,
      date: emissionDate
    },
    fleet: {
      licensePlate: plateMatch ? plateMatch[1].toUpperCase() : null,
      mileage: kmMatch ? parseInt(kmMatch[1], 10) : null,
      driver: driverMatch ? driverMatch[1].trim() : null
    },
    raw_obs: rawExtraInfo
  };
}
