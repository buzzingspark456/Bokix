import React from 'react';

/**
 * Datumfält för filterrader. En tom datumruta ritas som helt blank i Safari på
 * iPhone (och som "yyyy-mm-dd" i Chrome), så man ser inte vad den är till för.
 * På telefon visas därför en läsbar etikett ("Från datum") i den tomma rutan;
 * på dator är fältet oförändrat. Se .date-field i index.css.
 */
export default function DateField({ value, onChange, placeholder = 'Datum', style, ...rest }) {
  return (
    <span className={`date-field${value ? ' has-value' : ''}`}>
      <input type="date" value={value} onChange={onChange} style={style} aria-label={placeholder} {...rest} />
      {!value && <span className="date-field-ph" aria-hidden="true">{placeholder}</span>}
    </span>
  );
}
