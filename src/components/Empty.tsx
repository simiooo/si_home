import React from 'react';

type EmptyProps = {
  title: string;
  text: string | React.ReactElement;
};

const Empty: React.FC<EmptyProps> = ({ title, text }) => {
  return (
    <div className="flex 
    rounded-lg bg-gray-100
    h-60
    items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div
        className='h-2'
        ></div>
        <p className="text-gray-500 mt-2">{text}</p>
      </div>
    </div>
  );
};

export default Empty;
