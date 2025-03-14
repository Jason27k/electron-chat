// src/Menu.tsx

const menuItems = [
  { name: "Mushroom Melt", comboPrice: "$7.79", price: "$4.19" },
  { name: "Philly Melt", comboPrice: "$7.79", price: "$4.19" },
  { name: "Chicken Tenders", comboPrice: "$7.99", price: "$4.39" },
  { name: "Turkey Bacon Club", comboPrice: "$8.29", price: "$4.69" },
  { name: "Barbecue Beef", comboPrice: "$6.99", price: "$3.39" },
  { name: "Grilled Chicken", comboPrice: "$8.09", price: "$4.69" },
];

const Menu = () => {
  return (
    <div className="flex flex-col items-center p-4 bg-blue-950 h-screen">
      <div className="grid grid-cols-2 gap-4">
        {menuItems.map((item, index) => (
          <div className="flex" key={index}>
            <div className="h-full bg-red-500 flex justify-center items-center w-16">
              <p className="text-6xl font-bold text-black">{index + 1}</p>
            </div>
            <div className="bg-white p-4 shadow-md w-72">
              <h2 className="text-xl font-semibold mb-2">
                {item.name.toUpperCase()}
              </h2>
              <div className="flex justify-between">
                <div>
                  <div className="pb-2.5">
                    <p className="text-3xl font-bold">{item.comboPrice}</p>
                    <p className="text-md font-semibold">MEDIUM COMBO</p>
                  </div>
                  <div>
                    <p className="text-md font-semibold">SANDWICH ONLY</p>
                    <p className="text-xl text-right">{item.price}</p>
                  </div>
                </div>
                <div className="bg-amber-500 w-30 h-30 flex justify-center items-center">
                  <span className="text-white font-bold">Combo</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Menu;
