import React from "react";

export default function FileUploader({ file, onChange, label, disabled }) {
  return (
    <>
      <input
        id={`upload-${label}`}
        type="file"
        accept=".pdf"
        hidden
        disabled={disabled}
        onChange={e => onChange(e.target.files[0] || null)}
      />
      <button
        disabled={disabled}
        onClick={() => document.getElementById(`upload-${label}`).click()}
      >
        {file?.name || label}
      </button>
    </>
  );
}
