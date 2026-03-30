import React from 'react';
import { createRoot } from 'react-dom/client';
import '@geotab/zenith/dist/index.css';
import App from './App';

geotab.addin.ptoAuxTracker = function () {
  let reactRoot = null;

  return {
    initialize(api, state, callback) {
      const el = document.getElementById('pto-aux-root');
      reactRoot = createRoot(el);
      reactRoot.render(<App api={api} />);
      callback();
    },
    focus(api) {
      if (reactRoot) reactRoot.render(<App api={api} />);
    },
    blur() {},
  };
};
