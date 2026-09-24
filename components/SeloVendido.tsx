// Tag VENDIDO no centro da foto (card do feed e página do imóvel) — o imóvel
// vendido fica 15 dias no feed e depois sai sozinho.
export default function SeloVendido({ grande = false }: { grande?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/15">
      <span
        className={`rounded-lg font-extrabold uppercase text-white shadow-lg ${grande ? 'px-7 py-2.5 text-2xl tracking-[0.25em]' : 'px-4 py-1.5 text-sm tracking-[0.2em]'}`}
        style={{ background: '#e62f2f' }}
      >
        Vendido
      </span>
    </div>
  );
}
