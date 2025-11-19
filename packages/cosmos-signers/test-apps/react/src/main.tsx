import { Apophis } from '@apophis-sdk/core';
import { DefaultCosmosMiddlewares } from '@apophis-sdk/cosmos';
import { registerCosmosSigners } from '@apophis-sdk/cosmos-signers';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

Apophis.use(...DefaultCosmosMiddlewares);
registerCosmosSigners();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
