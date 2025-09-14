const signOutButton = () => {
  return (
    <div className="flex items-center gap-4">
      <a
        href="/api/auth/signout"
        className="bg-transparent border border-blue-700 text-blue-700 text-sm px-4 py-2 rounded-md font-semibold hover:bg-blue-700 hover:text-white transition-colors"
      >
        Cerrar sesión
      </a>
    </div>
  );
};

export default signOutButton;
