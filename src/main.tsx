import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/quicksand';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './index.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Không tìm thấy phần tử #root để khởi động ứng dụng.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
