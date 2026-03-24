import React from 'react';
import ReactDOM from 'react-dom/client';
import PasscodeGate from './components/PasscodeGate.jsx';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <PasscodeGate appName="Vendor Compliance Portal">
    <App />
  </PasscodeGate>
);
