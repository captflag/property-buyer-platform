import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle, Clock, Image as ImageIcon } from 'lucide-react';

interface Update {
  id: string;
  projectId: string;
  title: string;
  description: string;
  date: string;
  images: string[];
  status: string;
}

export const ConstructionUpdates: React.FC = () => {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const response = await fetch('/api/updates/1');
        if (response.ok) {
          const data = await response.json();
          setUpdates(data.updates);
        }
      } catch (error) {
        console.error('Failed to fetch updates:', error);
        // Mock data for development
        setUpdates([
          {
            id: '1',
            projectId: '1',
            title: 'Foundation Complete',
            description: 'Foundation work has been completed successfully. All concrete has been poured and is curing properly. The structural integrity has been verified by our engineering team and we are ready to proceed to the next phase.',
            date: new Date().toISOString(),
            images: ['/foundation_work.png'],
            status: 'completed'
          },
          {
            id: '2',
            projectId: '1',
            title: 'Framing in Progress',
            description: 'Structural framing is 75% complete. Weather conditions have been favorable, allowing us to maintain our accelerated schedule. All materials meet specifications and the frame structure is looking excellent.',
            date: new Date(Date.now() - 86400000).toISOString(),
            images: ['/framing_progress.png'],
            status: 'in-progress'
          },
          {
            id: '3',
            projectId: '1',
            title: 'Interior Construction Underway',
            description: 'Interior construction has begun with flooring installation in progress. High ceilings and large windows are creating a bright, airy space. The contemporary design is coming together beautifully.',
            date: new Date(Date.now() - 172800000).toISOString(),
            images: ['/interior_construction.png'],
            status: 'in-progress'
          },
          {
            id: '4',
            projectId: '1',
            title: 'Roofing Installation Completed',
            description: 'Roofing installation has been successfully completed ahead of schedule. All materials are properly installed and weatherproofed. The modern design complements the overall architectural vision.',
            date: new Date(Date.now() - 259200000).toISOString(),
            images: ['/roofing_work.png'],
            status: 'completed'
          },
          {
            id: '5',
            projectId: '1',
            title: 'Electrical Rough-In Scheduled',
            description: 'Electrical rough-in work is scheduled to begin next week. All permits have been obtained and materials are on site. Our licensed electricians will ensure all work meets code requirements.',
            date: new Date(Date.now() - 345600000).toISOString(),
            images: [],
            status: 'scheduled'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchUpdates();
  }, []);

  if (loading) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <div className="loading-spinner-container">
          <div className="loading-spinner-modern"></div>
        </div>
        <span className="loading-text">Loading construction updates...</span>
      </div>
    );
  }

  return (
    <div className="construction-updates">
      <header className="page-header">
        <h1>Construction Updates</h1>
        <p className="page-description">
          Real-time progress updates and milestones for your construction project.
        </p>
      </header>

      <div className="updates-timeline" role="feed" aria-live="polite" aria-label="Construction updates timeline">
        {updates.length === 0 ? (
          <div className="no-updates" role="status">
            <p>No updates available at this time.</p>
          </div>
        ) : (
          updates.map((update, index) => (
            <article key={update.id} className="update-card" tabIndex={0} style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="update-timeline-marker">
                {update.status === 'completed' ? (
                  <CheckCircle size={24} className="timeline-icon timeline-icon-completed" />
                ) : update.status === 'in-progress' ? (
                  <Clock size={24} className="timeline-icon timeline-icon-progress" />
                ) : (
                  <Calendar size={24} className="timeline-icon timeline-icon-scheduled" />
                )}
              </div>

              <header className="update-header">
                <div className="update-meta">
                  <h2 className="update-title">{update.title}</h2>
                  <div className="update-details">
                    <span className={`update-status status--${update.status}`}>
                      {update.status.replace('-', ' ').toUpperCase()}
                    </span>
                    <time dateTime={update.date} className="update-date">
                      <Calendar size={14} className="inline-icon" />
                      {new Date(update.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </time>
                  </div>
                </div>
              </header>

              <div className="update-content">
                <p className="update-description">{update.description}</p>

                {update.images.length > 0 && (
                  <div className="update-images">
                    {update.images.map((imageUrl, imgIndex) => (
                      <div key={imgIndex} className="update-image-wrapper">
                        <img
                          src={imageUrl}
                          alt={`Construction progress for ${update.title}`}
                          className="update-image"
                          loading="lazy"
                        />
                        <div className="image-overlay">
                          <ImageIcon size={32} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      <section className="updates-info">
        <h2>About Construction Updates</h2>
        <ul>
          <li>Updates are posted in real-time as work progresses</li>
          <li>Photos are included when available and weather permits</li>
          <li>You'll receive notifications for major milestones</li>
          <li>All updates are timestamped for your records</li>
        </ul>
      </section>
    </div>
  );
};