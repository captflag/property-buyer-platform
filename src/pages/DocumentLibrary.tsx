import React, { useEffect, useState } from 'react';
import { FileText, Download, Eye, Search, File, FileCheck, FileSpreadsheet, Award } from 'lucide-react';

interface Document {
  id: string;
  projectId: string;
  name: string;
  type: string;
  url: string;
  uploadDate: string;
  size: string;
}

export const DocumentLibrary: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents/1');
        if (response.ok) {
          const data = await response.json();
          setDocuments(data.documents);
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        // Mock data for development
        setDocuments([
          {
            id: '1',
            projectId: '1',
            name: 'Building Permit',
            type: 'permit',
            url: '/documents/building-permit.pdf',
            uploadDate: '2023-09-01',
            size: '2.5 MB'
          },
          {
            id: '2',
            projectId: '1',
            name: 'Architectural Plans',
            type: 'blueprint',
            url: '/documents/architectural-plans.pdf',
            uploadDate: '2023-09-01',
            size: '15.2 MB'
          },
          {
            id: '3',
            projectId: '1',
            name: 'Contract Agreement',
            type: 'contract',
            url: '/documents/contract.pdf',
            uploadDate: '2023-08-15',
            size: '1.8 MB'
          },
          {
            id: '4',
            projectId: '1',
            name: 'Quality Inspection Certificate',
            type: 'certificate',
            url: '/documents/inspection.pdf',
            uploadDate: '2023-10-01',
            size: '1.2 MB'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'permit': return FileCheck;
      case 'blueprint': return FileSpreadsheet;
      case 'contract': return FileText;
      case 'certificate': return Award;
      default: return File;
    }
  };

  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'permit': return 'document-icon-permit';
      case 'blueprint': return 'document-icon-blueprint';
      case 'contract': return 'document-icon-contract';
      case 'certificate': return 'document-icon-certificate';
      default: return 'document-icon-default';
    }
  };

  if (loading) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <div className="loading-spinner-container">
          <div className="loading-spinner-modern"></div>
        </div>
        <span className="loading-text">Loading document library...</span>
      </div>
    );
  }

  return (
    <div className="document-library">
      <header className="page-header">
        <h1>Document Library</h1>
        <p className="page-description">
          Access all your project documents including permits, plans, contracts, and certifications.
        </p>
      </header>

      <div className="document-search">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            id="document-search"
            type="search"
            className="search-input"
            placeholder="Search by document name or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-describedby="search-help"
          />
        </div>
        <div id="search-help" className="search-help">
          {filteredDocuments.length} of {documents.length} documents
        </div>
      </div>

      <div className="documents-grid">
        {filteredDocuments.length === 0 ? (
          <div className="no-documents" role="status">
            <p>
              {searchTerm
                ? `No documents found matching "${searchTerm}"`
                : 'No documents available at this time.'
              }
            </p>
          </div>
        ) : (
          filteredDocuments.map((document, index) => {
            const IconComponent = getDocumentIcon(document.type);
            return (
              <article key={document.id} className="document-card" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="document-header">
                  <div className={`document-icon ${getDocumentColor(document.type)}`}>
                    <IconComponent size={32} strokeWidth={1.5} />
                  </div>
                  <div className="document-meta">
                    <h2 className="document-name">{document.name}</h2>
                    <span className="document-type">{document.type.toUpperCase()}</span>
                  </div>
                </div>

                <div className="document-details">
                  <div className="document-info">
                    <span className="info-label">Uploaded:</span>
                    <time dateTime={document.uploadDate}>
                      {new Date(document.uploadDate).toLocaleDateString()}
                    </time>
                  </div>
                  <div className="document-info">
                    <span className="info-label">Size:</span>
                    <span>{document.size}</span>
                  </div>
                </div>

                <div className="document-actions">
                  <a
                    href={document.url}
                    className="document-link document-link-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${document.name} (opens in new tab)`}
                  >
                    <Eye size={18} />
                    View
                  </a>
                  <a
                    href={document.url}
                    className="document-link document-link-secondary"
                    download={document.name}
                    aria-label={`Download ${document.name}`}
                  >
                    <Download size={18} />
                    Download
                  </a>
                </div>
              </article>
            );
          })
        )}
      </div>

      <section className="document-info">
        <h2>Document Categories</h2>
        <ul>
          <li><strong>Permits:</strong> Building permits and regulatory approvals</li>
          <li><strong>Blueprints:</strong> Architectural and engineering plans</li>
          <li><strong>Contracts:</strong> Legal agreements and specifications</li>
          <li><strong>Certificates:</strong> Quality inspections and certifications</li>
        </ul>
      </section>
    </div>
  );
};