import { Address, Accounts, Payments, TrustLines } from 'xrpl-connect';

// --- Generate ---

const addressOutput = document.getElementById('address-output');

document.getElementById('run-address').addEventListener('click', () => {
  const generated = Address.generate();
  console.log('Address.generate()', generated);
  addressOutput.textContent = JSON.stringify(generated, null, 2);
});

// --- Seed ---

const seedField = document.getElementById('seed-field');
const seedGenerateButton = document.getElementById('seed-generate');
const seedImportButton = document.getElementById('seed-import');
const seedUiOutput = document.getElementById('seed-ui-output');

function updateSeedImportButton() {
  seedImportButton.disabled = !Address.isValidSeed(seedField.value.trim());
}

seedField.addEventListener('input', updateSeedImportButton);

seedGenerateButton.addEventListener('click', () => {
  seedField.value = Address.generate().seed;
  updateSeedImportButton();
  seedUiOutput.textContent = '';
});

seedImportButton.addEventListener('click', () => {
  const result = Address.importBySeed(seedField.value.trim());
  console.log('Address.importBySeed(seed)', result);
  seedUiOutput.textContent = JSON.stringify(result, null, 2);
});

// --- Hex ---

const hexField = document.getElementById('hex-field');
const hexGenerateButton = document.getElementById('hex-generate');
const hexImportButton = document.getElementById('hex-import');
const hexUiOutput = document.getElementById('hex-ui-output');

function updateHexImportButton() {
  hexImportButton.disabled = !Address.isValidHex(hexField.value.trim());
}

hexField.addEventListener('input', updateHexImportButton);

hexGenerateButton.addEventListener('click', () => {
  hexField.value = Address.generate().privateKey;
  updateHexImportButton();
  hexUiOutput.textContent = '';
});

hexImportButton.addEventListener('click', () => {
  const result = Address.importByHex(hexField.value.trim());
  console.log('Address.importByHex(privateKey)', result);
  hexUiOutput.textContent = JSON.stringify(result, null, 2);
});

// --- Mnemonic ---

const mnemonicField = document.getElementById('mnemonic-field');
const mnemonicGenerateButton = document.getElementById('mnemonic-generate');
const mnemonicImportButton = document.getElementById('mnemonic-import');
const mnemonicUiOutput = document.getElementById('mnemonic-ui-output');

function updateMnemonicImportButton() {
  mnemonicImportButton.disabled = !Address.isValidMnemonic(mnemonicField.value.trim());
}

mnemonicField.addEventListener('input', updateMnemonicImportButton);

mnemonicGenerateButton.addEventListener('click', () => {
  mnemonicField.value = Address.generateMnemonic();
  updateMnemonicImportButton();
  mnemonicUiOutput.textContent = '';
});

mnemonicImportButton.addEventListener('click', () => {
  const result = Address.importByMnemonic(mnemonicField.value.trim());
  console.log('Address.importByMnemonic(mnemonic)', result);
  mnemonicUiOutput.textContent = JSON.stringify(result, null, 2);
});

// --- Xaman ---

const xamanFields = Array.from(document.querySelectorAll('.xaman-group'));
const xamanGenerateButton = document.getElementById('xaman-generate');
const xamanImportButton = document.getElementById('xaman-import');
const xamanUiOutput = document.getElementById('xaman-ui-output');

function updateXamanImportButton() {
  const groups = xamanFields.map((field) => field.value.trim());
  xamanImportButton.disabled = !Address.isValidXamanSecretNumbers(groups);
}

xamanFields.forEach((field) => field.addEventListener('input', updateXamanImportButton));

xamanGenerateButton.addEventListener('click', () => {
  Address.generateXamanSecretNumbers().forEach((group, i) => {
    xamanFields[i].value = group;
  });
  updateXamanImportButton();
  xamanUiOutput.textContent = '';
});

xamanImportButton.addEventListener('click', () => {
  const groups = xamanFields.map((field) => field.value.trim());
  const result = Address.importByXaman(groups);
  console.log('Address.importByXaman(groups)', result);
  xamanUiOutput.textContent = JSON.stringify(result, null, 2);
});

// --- Balances ---

const balancesAddressField = document.getElementById('balances-address-field');
const balancesNetworkField = document.getElementById('balances-network-field');
const balancesFetchButton = document.getElementById('balances-fetch');
const balancesXrpOutput = document.getElementById('balances-xrp-output');
const balancesTokensOutput = document.getElementById('balances-tokens-output');
const balancesMptOutput = document.getElementById('balances-mpt-output');

function updateBalancesFetchButton() {
  balancesFetchButton.disabled = !Address.isValidClassicAddress(balancesAddressField.value.trim());
}

balancesAddressField.addEventListener('input', updateBalancesFetchButton);

// `fetchBalance` opens its own network connection per call — three of these fired at
// once (one per output below) can race and time out against the same server, so this
// runs them one at a time instead of with Promise.all.
async function loadBalance(fetchBalance, output, describeEmpty) {
  output.textContent = 'Loading…';
  try {
    const result = await fetchBalance();
    console.log(output.id, result);
    const isEmptyList = Array.isArray(result) && result.length === 0;
    output.textContent = isEmptyList ? describeEmpty : JSON.stringify(result, null, 2);
  } catch (error) {
    console.error(output.id, error);
    output.textContent = `Error: ${error.message}`;
  }
}

balancesFetchButton.addEventListener('click', async () => {
  const address = balancesAddressField.value.trim();
  const network = balancesNetworkField.value;

  balancesFetchButton.disabled = true;
  await loadBalance(() => Accounts.getXrpBalance(address, network), balancesXrpOutput, '(unfunded)');
  await loadBalance(
    () => Accounts.getTokenBalances(address, network),
    balancesTokensOutput,
    '(no trustlines)'
  );
  await loadBalance(() => Accounts.getMptBalances(address, network), balancesMptOutput, '(no MPTs)');
  balancesFetchButton.disabled = false;
});

// --- Send payment ---

const sendAssetField = document.getElementById('send-asset-field');
const sendSeedField = document.getElementById('send-seed-field');
const sendDestinationField = document.getElementById('send-destination-field');
const sendAmountField = document.getElementById('send-amount-field');
const sendTokenFields = document.getElementById('send-token-fields');
const sendCurrencyField = document.getElementById('send-currency-field');
const sendIssuerField = document.getElementById('send-issuer-field');
const sendMptFields = document.getElementById('send-mpt-fields');
const sendMptIssuanceField = document.getElementById('send-mpt-issuance-field');
const sendNetworkField = document.getElementById('send-network-field');
const sendSubmitButton = document.getElementById('send-submit');
const sendOutput = document.getElementById('send-output');

function updateSendAssetVisibility() {
  const asset = sendAssetField.value;
  sendTokenFields.hidden = asset !== 'token';
  sendMptFields.hidden = asset !== 'mpt';
  updateSendSubmitButton();
}

function updateSendSubmitButton() {
  const asset = sendAssetField.value;
  const hasCommonFields =
    Address.isValidSeed(sendSeedField.value.trim()) &&
    Address.isValidClassicAddress(sendDestinationField.value.trim()) &&
    sendAmountField.value.trim().length > 0;
  const hasAssetFields =
    asset === 'xrp' ||
    (asset === 'token' &&
      sendCurrencyField.value.trim().length > 0 &&
      Address.isValidClassicAddress(sendIssuerField.value.trim())) ||
    (asset === 'mpt' && sendMptIssuanceField.value.trim().length > 0);
  sendSubmitButton.disabled = !(hasCommonFields && hasAssetFields);
}

[sendSeedField, sendDestinationField, sendAmountField, sendCurrencyField, sendIssuerField, sendMptIssuanceField].forEach(
  (field) => field.addEventListener('input', updateSendSubmitButton)
);
sendAssetField.addEventListener('change', updateSendAssetVisibility);
updateSendAssetVisibility();

sendSubmitButton.addEventListener('click', async () => {
  const asset = sendAssetField.value;
  const credential = { seed: sendSeedField.value.trim() };
  const destination = sendDestinationField.value.trim();
  const network = sendNetworkField.value;
  const amount = sendAmountField.value.trim();

  sendSubmitButton.disabled = true;
  sendOutput.textContent = 'Submitting…';
  try {
    let result;
    if (asset === 'xrp') {
      result = await Payments.sendXrp({ credential, destination, amountXrp: amount, network });
    } else if (asset === 'token') {
      result = await Payments.sendToken({
        credential,
        destination,
        currency: sendCurrencyField.value.trim(),
        issuer: sendIssuerField.value.trim(),
        value: amount,
        network,
      });
    } else {
      result = await Payments.sendMpt({
        credential,
        destination,
        mptIssuanceId: sendMptIssuanceField.value.trim(),
        value: amount,
        network,
      });
    }
    console.log('Payments.send*()', result);
    sendOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    console.error('send payment', error);
    sendOutput.textContent = `Error: ${error.message}`;
  } finally {
    updateSendSubmitButton();
  }
});

// --- Trust line ---

const trustAssetField = document.getElementById('trust-asset-field');
const trustSeedField = document.getElementById('trust-seed-field');
const trustTokenFields = document.getElementById('trust-token-fields');
const trustCurrencyField = document.getElementById('trust-currency-field');
const trustIssuerField = document.getElementById('trust-issuer-field');
const trustLimitField = document.getElementById('trust-limit-field');
const trustMptFields = document.getElementById('trust-mpt-fields');
const trustMptIssuanceField = document.getElementById('trust-mpt-issuance-field');
const trustAuthorizeField = document.getElementById('trust-authorize-field');
const trustNetworkField = document.getElementById('trust-network-field');
const trustSubmitButton = document.getElementById('trust-submit');
const trustOutput = document.getElementById('trust-output');

function updateTrustAssetVisibility() {
  const asset = trustAssetField.value;
  trustTokenFields.hidden = asset !== 'token';
  trustMptFields.hidden = asset !== 'mpt';
  updateTrustSubmitButton();
}

function updateTrustSubmitButton() {
  const asset = trustAssetField.value;
  const hasSeed = Address.isValidSeed(trustSeedField.value.trim());
  const hasAssetFields =
    (asset === 'token' &&
      trustCurrencyField.value.trim().length > 0 &&
      Address.isValidClassicAddress(trustIssuerField.value.trim()) &&
      trustLimitField.value.trim().length > 0) ||
    (asset === 'mpt' && trustMptIssuanceField.value.trim().length > 0);
  trustSubmitButton.disabled = !(hasSeed && hasAssetFields);
}

[trustSeedField, trustCurrencyField, trustIssuerField, trustLimitField, trustMptIssuanceField].forEach(
  (field) => field.addEventListener('input', updateTrustSubmitButton)
);
trustAssetField.addEventListener('change', updateTrustAssetVisibility);
updateTrustAssetVisibility();

trustSubmitButton.addEventListener('click', async () => {
  const asset = trustAssetField.value;
  const credential = { seed: trustSeedField.value.trim() };
  const network = trustNetworkField.value;

  trustSubmitButton.disabled = true;
  trustOutput.textContent = 'Submitting…';
  try {
    let result;
    if (asset === 'token') {
      result = await TrustLines.setTokenTrustLine({
        credential,
        currency: trustCurrencyField.value.trim(),
        issuer: trustIssuerField.value.trim(),
        limit: trustLimitField.value.trim(),
        network,
      });
    } else {
      result = await TrustLines.setMptTrustLine({
        credential,
        mptIssuanceId: trustMptIssuanceField.value.trim(),
        authorize: trustAuthorizeField.checked,
        network,
      });
    }
    console.log('TrustLines.set*TrustLine()', result);
    trustOutput.textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    console.error('trust line', error);
    trustOutput.textContent = `Error: ${error.message}`;
  } finally {
    updateTrustSubmitButton();
  }
});

// --- Current trust lines ---

const trustLinesAddressField = document.getElementById('trustlines-address-field');
const trustLinesNetworkField = document.getElementById('trustlines-network-field');
const trustLinesFetchButton = document.getElementById('trustlines-fetch');
const trustLinesOutput = document.getElementById('trustlines-output');

function updateTrustLinesFetchButton() {
  trustLinesFetchButton.disabled = !Address.isValidClassicAddress(trustLinesAddressField.value.trim());
}

trustLinesAddressField.addEventListener('input', updateTrustLinesFetchButton);

trustLinesFetchButton.addEventListener('click', async () => {
  const address = trustLinesAddressField.value.trim();
  const network = trustLinesNetworkField.value;

  trustLinesFetchButton.disabled = true;
  trustLinesOutput.textContent = 'Loading…';
  try {
    const lines = await TrustLines.getTrustLines(address, network);
    console.log('TrustLines.getTrustLines()', lines);
    trustLinesOutput.textContent = lines.length ? JSON.stringify(lines, null, 2) : '(no trust lines)';
  } catch (error) {
    console.error('getTrustLines', error);
    trustLinesOutput.textContent = `Error: ${error.message}`;
  } finally {
    updateTrustLinesFetchButton();
  }
});
