// ============================================================
// MONGODB BRAND (palette from mongodb.com / LeafyGreen design system)
// slate #001E2B · spring green #00ED64 · forest #00684A · evergreen #023430 · mist #E3FCF7
// ============================================================
export const BRAND_FONT = '"DM Sans", "Euclid Circular A", "Helvetica Neue", Helvetica, Arial, sans-serif';

export const BRAND_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
.mdb-btn-primary{background:#00684A;}
.mdb-btn-primary:hover:not(:disabled){background:#023430;}
.mdb-btn-primary:disabled{background:#94a3b8;}
.mdb-nav-active{background:#E3FCF7;color:#00684A;box-shadow:inset 3px 0 0 #00ED64;}
.mdb-role-active{background:#001E2B;border-color:#001E2B;color:#fff;}
.mdb-bar{background:#00684A;}
.mdb-dot-spring{background:#00ED64;}
.mdb-input:focus{border-color:#00684A;box-shadow:0 0 0 3px #E3FCF7;outline:none;}
@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
  .no-print { display: none !important; }
}
`;

export function Leaf({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="#00ED64" d="M12 1.6c-3.4 5-4.3 10-3.1 14.3.8 3 2.3 5 2.7 6.1.1.3.7.3.8 0 .4-1.1 1.9-3.1 2.7-6.1C16.3 11.6 15.4 6.6 12 1.6z" />
      <path fill="#023430" opacity="0.45" d="M11.7 22h.6v-9.5h-.6z" />
    </svg>
  );
}
