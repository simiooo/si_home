import React from 'react';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea: React.FC<TextareaProps> = ({ className, ...props }) => {
  return (
    <textarea
      {...props}
      className={`
        ${className || ''}
        block w-full px-4 py-2 text-sm text-gray-700 placeholder-gray-400 bg-white border border-gray-300 rounded-lg shadow-sm appearance-none focus:outline-none focus:border-sky-500 focus:ring focus:ring-sky-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-500 dark:text-gray-100 dark:focus:ring-offset-gray-800
        invalid:border-pink-500 invalid:text-pink-600 focus:border-sky-500 focus:outline focus:outline-sky-500 focus:invalid:border-pink-500 focus:invalid:outline-pink-500 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500 disabled:shadow-none dark:disabled:border-gray-700 dark:disabled:bg-gray-800/20
      `}
    />
  );
};

export default Textarea;
