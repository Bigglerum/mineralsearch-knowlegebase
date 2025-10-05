export default function Header() {
  return (
    <header className="fixed top-0 w-full bg-primary text-white px-5 py-3 flex justify-between items-center z-50 shadow-md">
      <div className="bg-white text-primary px-3 py-1.5 rounded font-bold text-base">
        <span className="text-primary">e-</span>
        <span className="text-black">rocks</span>
      </div>
      
      <div className="text-sm font-medium">
        Mineral Explorer
      </div>
    </header>
  );
}
