import { useWallet } from '../context/WalletContext';

export function AccountInfo() {
  const { isConnected, accountInfo } = useWallet();

  if (!isConnected || !accountInfo) {
    return null;
  }

  return (
    <section id="account-section">
      <h2>Account Info</h2>
      <div className="info-card">
        <div className="info-row">
          <span className="label">Address:</span>
          <span className="value">{accountInfo.address}</span>
        </div>
        <div className="info-row">
          <span className="label">Network:</span>
          <span className="value">{accountInfo.network}</span>
        </div>
        <div className="info-row">
          <span className="label">Wallet:</span>
          <span className="value">{accountInfo.walletName}</span>
        </div>
      </div>
      <p className="section-description">Click the button showing your address to disconnect</p>
    </section>
  );
}
