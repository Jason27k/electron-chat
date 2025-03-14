import React from "react";

const Chat: React.FC = () => {
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-start mb-4">
          <img
            src="https://placehold.co/40x40"
            alt="User"
            className="rounded-full mr-2"
          />
          <div>
            <div className="flex items-center">
              <span className="font-bold">pigeon</span>
              <span className="text-sm text-gray-400 ml-2">
                Today at 6:21 PM
              </span>
            </div>
            <p className="text-gray-300">Hello! How can I assist you today?</p>
          </div>
        </div>
        <div className="flex items-start mb-4">
          <img
            src="https://placehold.co/40x40"
            alt="User"
            className="rounded-full mr-2"
          />
          <div>
            <div className="flex items-center">
              <span className="font-bold">exerinity</span>
              <span className="text-sm text-gray-400 ml-2">
                Today at 6:21 PM
              </span>
            </div>
            <p className="text-gray-300">
              What's the difference between Wi-Fi 2.4 GHz and 5 GHz?
            </p>
          </div>
        </div>
        <div className="flex items-start mb-4">
          <img
            src="https://placehold.co/40x40"
            alt="User"
            className="rounded-full mr-2"
          />
          <div>
            <div className="flex items-center">
              <span className="font-bold">pigeon</span>
              <span className="text-sm text-gray-400 ml-2">
                Today at 6:21 PM
              </span>
            </div>
            <p className="text-gray-300">
              The main differences between 2.4 GHz and 5 GHz lie in their range,
              speed, and interference.
            </p>
          </div>
        </div>
        <div className="flex items-start mb-4">
          <img
            src="https://placehold.co/40x40"
            alt="User"
            className="rounded-full mr-2"
          />
          <div>
            <div className="flex items-center">
              <span className="font-bold">exerinity</span>
              <span className="text-sm text-gray-400 ml-2">
                Today at 6:22 PM
              </span>
            </div>
            <p className="text-gray-300">
              Can you explain more about the interference issues?
            </p>
          </div>
        </div>
        <div className="flex items-start mb-4">
          <img
            src="https://placehold.co/40x40"
            alt="User"
            className="rounded-full mr-2"
          />
          <div>
            <div className="flex items-center">
              <span className="font-bold">pigeon</span>
              <span className="text-sm text-gray-400 ml-2">
                Today at 6:23 PM
              </span>
            </div>
            <p className="text-gray-300">
              Sure! The 2.4 GHz frequency is more prone to interference from
              devices like microwaves and cordless phones. This can lead to
              slower connections. On the other hand, 5 GHz has more channels
              available, which helps reduce interference and allows for higher
              speeds, especially for activities like streaming and gaming.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-800">
        <input
          type="text"
          placeholder="Type your message..."
          className="w-full p-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none"
        />
      </div>
    </div>
  );
};

export default Chat;
