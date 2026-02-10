export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="flex-shrink-0 border-t py-2 text-center text-xs"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        color: 'var(--text-muted)',
      }}
    >
      Wszystkie prawa zastrzeżone: Dariusz Ciesielski - Marketing Ekspercki, {year}.
    </footer>
  );
}
