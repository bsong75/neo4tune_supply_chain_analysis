import { useState, useRef } from 'react';
import api from '../api';

export default function UploadPanel({ onIngestComplete }) {
  const [step, setStep] = useState('idle');
  const [dataType, setDataType] = useState('entities');
  const [previewData, setPreviewData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef();

  const handlePreview = async () => {
    const file = fileRef.current?.files[0];
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('data_type', dataType);
      const resp = await api.post('/ingest/preview', formData);
      setPreviewData(resp.data);

      const autoMapping = {};
      for (const target of resp.data.target_fields) {
        const match = resp.data.columns.find(
          (c) => c.toLowerCase() === target.toLowerCase()
        );
        autoMapping[target] = match || '';
      }
      setMapping(autoMapping);
      setStep('mapping');
    } catch (err) {
      setMessage(err.response?.data?.error || err.message);
    }
    setUploading(false);
  };

  const handleIngest = async () => {
    if (!previewData) return;
    setUploading(true);
    setMessage('');
    try {
      const resp = await api.post('/ingest/mapped', {
        records: previewData.records,
        mapping,
        data_type: dataType,
      });
      setMessage(JSON.stringify(resp.data));
      setStep('idle');
      setPreviewData(null);
      onIngestComplete();
    } catch (err) {
      setMessage(err.response?.data?.error || err.message);
    }
    setUploading(false);
  };

  const handleCancel = () => {
    setStep('idle');
    setPreviewData(null);
    setMapping({});
    setMessage('');
  };

  const mappedPreview = previewData?.preview?.map((row) => {
    const mapped = {};
    for (const [target, source] of Object.entries(mapping)) {
      mapped[target] = source ? (row[source] || '') : '';
    }
    return mapped;
  });

  return (
    <div className="drawer-panel">
      <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>Upload Data</h3>

      {step === 'idle' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                name="dataType"
                value="entities"
                checked={dataType === 'entities'}
                onChange={() => setDataType('entities')}
              />
              Entities
            </label>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                name="dataType"
                value="links"
                checked={dataType === 'links'}
                onChange={() => setDataType('links')}
              />
              Links
            </label>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.xlsx"
            style={{ display: 'block', margin: '8px 0', fontSize: '12px', color: 'var(--text-muted)' }}
          />
          <button
            onClick={handlePreview}
            disabled={uploading}
            style={{
              padding: '6px 12px',
              background: '#505050',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {uploading ? 'Reading...' : 'Upload & Map Columns'}
          </button>
        </>
      )}

      {step === 'mapping' && previewData && (
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {previewData.total_rows} records | Mapping: {dataType}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {previewData.target_fields.map((field) => (
              <div key={field} style={{ fontSize: '11px' }}>
                <div style={{ color: 'var(--text-dim)', marginBottom: '2px' }}>{field}</div>
                <select
                  value={mapping[field] || ''}
                  onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
                  style={{
                    padding: '3px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '3px',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                  }}
                >
                  <option value="">-- skip --</option>
                  {previewData.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {mappedPreview && mappedPreview.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
              <table style={{ fontSize: '10px', borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    {Object.keys(mappedPreview[0]).map((key) => (
                      <th key={key} style={{ padding: '3px 6px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedPreview.map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} style={{ padding: '3px 6px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-light)',
                borderRadius: '4px',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleIngest}
              disabled={uploading}
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#505050',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {uploading ? 'Ingesting...' : `Ingest ${previewData.total_rows} Records`}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div style={{ fontSize: '11px', marginTop: '8px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>
          {message}
        </div>
      )}
    </div>
  );
}
