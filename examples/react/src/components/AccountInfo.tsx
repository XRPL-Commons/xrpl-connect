import { useWallet } from '@xrpl-commons/xrpl-connect-react';

export function AccountInfo() {
  const { connected, account, network, manager } = useWallet();

  if (!connected || !account) {
    return null;
  }

  return (
    <section id="account-section">
      <h2>Account Info</h2>
      <div className="info-card">
        <div className="info-row">
          <span className="label">Address:</span>
          <span className="value">{account.address}</span>
        </div>
        <div className="info-row">
          <span className="label">Network:</span>
          <span className="value">
            {network ? `${network.name} (${network.id})` : account.network.id}
          </span>
        </div>
        <div className="info-row">
          <span className="label">Wallet:</span>
          <span className="value">{manager.wallet?.name ?? '—'}</span>
        </div>
      </div>
      <p className="section-description">Click the button showing your address to disconnect</p>
    </section>
  );
}
