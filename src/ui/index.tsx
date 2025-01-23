import React from 'react';
import { createRoot } from 'react-dom/client';

const Popup: React.FC = () => {
  return (
    <div className="popup">
      <h1>Hello from Chrome Extension!</h1>
      <p>This is a basic popup.</p>
    </div>
  );
};

const domNode = document.getElementById('root');
const root = createRoot(domNode);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);