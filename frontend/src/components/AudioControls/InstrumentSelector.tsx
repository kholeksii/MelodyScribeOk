import React from 'react';
import { Instrument } from '../../types';

interface InstrumentSelectorProps {
  value: Instrument;
  onChange: (value: Instrument) => void;
}

export const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({
  value,
  onChange,
}) => {
  const instruments: { value: Instrument; label: string }[] = [
    { value: 'violin', label: 'Violin' },
    { value: 'piano', label: 'Piano' },
    { value: 'guitar', label: 'Guitar' },
  ];

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="instrument-select" className="text-sm font-medium text-gray-700">
        Instrument:
      </label>
      <select
        id="instrument-select"
        value={value}
        onChange={(e) => onChange(e.target.value as Instrument)}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
      >
        {instruments.map((instrument) => (
          <option key={instrument.value} value={instrument.value}>
            {instrument.label}
          </option>
        ))}
      </select>
    </div>
  );
};