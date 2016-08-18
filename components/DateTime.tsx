import * as React from 'react';

// has the pattern 'MMMM d, y h:mm A'
const defaultOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
};

interface DateTimeProps {
  date: Date | string;
  options?: Intl.DateTimeFormatOptions;
}
const DateTime = ({date, options = defaultOptions}: DateTimeProps) => {
  // date is technically required, but this will render even if it isn't supplied
  if (date === undefined) {
    return <time />;
  }
  else {
    const dateObject = date instanceof Date ? date : new Date(date);
    const text = dateObject.toLocaleString('en-US', options);
    return <time dateTime={dateObject.toISOString()}>{text}</time>;
  }
};

export default DateTime;
