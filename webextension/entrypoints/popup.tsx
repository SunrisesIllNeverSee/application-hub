import { createRoot } from 'react-dom/client';

function Popup() {
  return (
    <div style={{ padding: '1rem', minWidth: '300px' }}>
      <h1 style={{ fontSize: '1rem', fontWeight: 600 }}>Application Hub</h1>
      <p style={{ fontSize: '0.875rem', color: '#666' }}>Loading...</p>
    </div>
  );
}

const root = document.getElementById('app')!;
createRoot(root).render(<Popup />);
