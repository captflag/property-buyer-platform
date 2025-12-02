import React, { useEffect, useState } from 'react';
import { TrendingUp, Calendar, MapPin, Clock, ArrowRight, Image as ImageIcon, FileCheck, MessageCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  address: string;
  status: string;
  completionPercentage: number;
  estimatedCompletion: string;
}

export const Dashboard: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock API call - replace with actual API integration
    const fetchProject = async () => {
      try {
        const response = await fetch('/api/projects/1');
        if (response.ok) {
          const data = await response.json();
          setProject(data.project);
        }
      } catch (error) {
        console.error('Failed to fetch project:', error);
        // Mock data for development
        setProject({
          id: '1',
          name: 'Sunset Villa Construction',
          address: '123 Sunset Drive, California',
          status: 'in-progress',
          completionPercentage: 65,
          estimatedCompletion: '2024-03-15',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, []);

  if (loading) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        <div className="loading-spinner-container">
          <div className="loading-spinner-modern"></div>
        </div>
        <span className="loading-text">Loading your project dashboard...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-error" role="alert">
        <h1>Unable to load project information</h1>
        <p>Please try refreshing the page or contact support.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="page-header">
        <h1>Project Dashboard</h1>
        <p className="page-description">
          Welcome back! Here's the latest overview of your construction project.
        </p>
      </header>

      {/* Hero Section with Image */}
      <div className="dashboard-hero">
        <div className="hero-image-container">
          <img
            src="/modern_villa_construction.png"
            alt="Modern villa under construction"
            className="hero-image"
          />
          <div className="hero-overlay">
            <div className="hero-content">
              <h2 className="hero-title">{project.name}</h2>
              <div className="hero-meta">
                <span className="hero-meta-item">
                  <MapPin size={16} />
                  {project.address}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-card-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Completion</span>
            <span className="stat-card-value">{project.completionPercentage}%</span>
          </div>
          <div className="stat-card-progress">
            <div
              className="stat-card-progress-fill"
              style={{ width: `${project.completionPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-card-icon">
            <Calendar size={24} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Expected Completion</span>
            <span className="stat-card-value">
              {new Date(project.estimatedCompletion).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-card-icon">
            <Clock size={24} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-label">Status</span>
            <span className="stat-card-value">
              {project.status.replace('-', ' ').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Project Overview Card */}
      <div className="project-overview">
        <div className="project-card">
          <div className="project-card-header">
            <h2 className="project-name">{project.name}</h2>
            <span className={`status status--${project.status}`}>
              {project.status.replace('-', ' ').toUpperCase()}
            </span>
          </div>
          <p className="project-address">
            <MapPin size={16} className="inline-icon" />
            {project.address}
          </p>

          <div className="project-stats">
            <div className="stat">
              <span className="stat-label">Overall Progress</span>
              <div className="progress-bar" role="progressbar" aria-valuenow={project.completionPercentage} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="progress-fill"
                  style={{ width: `${project.completionPercentage}%` }}
                ></div>
                <span className="progress-text">{project.completionPercentage}% Complete</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="dashboard-grid">
        <section className="dashboard-section dashboard-section-updates">
          <div className="section-icon-wrapper">
            <ImageIcon size={32} className="section-icon" />
          </div>
          <h2>Recent Updates</h2>
          <p>Latest construction progress and milestones with photos and detailed reports.</p>
          <a href="/updates" className="section-link">
            View All Updates
            <ArrowRight size={16} className="link-arrow" />
          </a>
        </section>

        <section className="dashboard-section dashboard-section-documents">
          <div className="section-icon-wrapper">
            <FileCheck size={32} className="section-icon" />
          </div>
          <h2>Document Library</h2>
          <p>Access permits, architectural plans, and all project documentation.</p>
          <a href="/documents" className="section-link">
            Browse Documents
            <ArrowRight size={16} className="link-arrow" />
          </a>
        </section>

        <section className="dashboard-section dashboard-section-support">
          <div className="section-icon-wrapper">
            <MessageCircle size={32} className="section-icon" />
          </div>
          <h2>AI Support</h2>
          <p>Get instant answers to your construction questions 24/7.</p>
          <a href="/support" className="section-link">
            Ask Questions
            <ArrowRight size={16} className="link-arrow" />
          </a>
        </section>
      </div>
    </div>
  );
};