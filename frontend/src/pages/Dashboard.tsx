import { useState } from 'react';
import { Box, Thermometer, Zap, Cpu, ArrowRight } from 'lucide-react';
import type { HealthResponse, SystemInfoResponse } from '../types/api';

type Page = 'dashboard' | 'geometry' | 'thermal' | 'performance' | 'hardware' | 'neural' | 'tests' | 'docs';

interface Props {
  backendUp: boolean;
  health: HealthResponse | null;
  sysInfo: SystemInfoResponse | null;
  onNavigate: (page: Page) => void;
}

// Custom Isometric 3D Cube Icon matching the reference image exactly
function IsometricCubeIcon({ size = 38, color = '#2583FF' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 4L34 12V28L20 36L6 28V12L20 4Z"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20L34 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20V36"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20L6 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Custom Neural Network Graph Icon matching the reference image
function NeuralNodesIcon({ size = 32, color = '#2583FF' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="8" r="3.5" stroke={color} strokeWidth="2.2" />
      <circle cx="8" cy="24" r="3.5" stroke={color} strokeWidth="2.2" />
      <circle cx="24" cy="24" r="3.5" stroke={color} strokeWidth="2.2" />
      <path d="M14 11L9.5 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M18 11L22.5 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M11.5 24H20.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const MODULES = [
  {
    id: 'geometry' as Page,
    title: 'Geometry',
    subtitle: 'View STL/CSV in 3D',
    renderIcon: () => <IsometricCubeIcon size={38} color="#2583FF" />,
  },
  {
    id: 'thermal' as Page,
    title: 'Thermal\nAnalysis',
    subtitle: '1D FEM with verification',
    renderIcon: () => <Thermometer size={34} strokeWidth={2.2} color="#3B82F6" />,
  },
  {
    id: 'performance' as Page,
    title: 'Performance',
    subtitle: 'Serial vs parallel benchmarking',
    renderIcon: () => <Zap size={34} strokeWidth={2.2} color="#3B82F6" />,
  },
  {
    id: 'hardware' as Page,
    title: 'Hardware',
    subtitle: 'MCU, FPGA, JTAG (simulated)',
    renderIcon: () => <Cpu size={34} strokeWidth={2.2} color="#3B82F6" />,
  },
  {
    id: 'neural' as Page,
    title: 'Neural Network',
    subtitle: 'Backpropagation and gradient check',
    renderIcon: () => <NeuralNodesIcon size={34} color="#3B82F6" />,
  },
];

export default function Dashboard({ onNavigate }: Props) {
  const [activeCard, setActiveCard] = useState<string>('geometry');

  return (
    <div className="overview-container">
      {/* Background ambient glowing curve matching reference design */}
      <svg
        className="hero-wave-background"
        viewBox="0 0 1400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waveGlowGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#1E40AF" stopOpacity="0" />
            <stop offset="25%" stopColor="#2563EB" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.8" />
            <stop offset="75%" stopColor="#60A5FA" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
          </linearGradient>
          <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Diffuse ambient glow line behind */}
        <path
          d="M 50 260 C 350 260, 550 210, 800 180 C 1050 150, 1200 110, 1380 100"
          stroke="url(#waveGlowGrad)"
          strokeWidth="6"
          fill="none"
          opacity="0.35"
          filter="url(#glowBlur)"
        />

        {/* Sharp crisp highlight line */}
        <path
          d="M 50 260 C 350 260, 550 210, 800 180 C 1050 150, 1200 110, 1380 100"
          stroke="url(#waveGlowGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Hero Title & Subtitle */}
      <div className="overview-hero">
        <h1 className="overview-hero-title">Engineering Workbench</h1>
        <p className="overview-hero-subtitle">
          Engineering simulation and analysis in one workspace.
        </p>
      </div>

      {/* 5 Module Cards Row */}
      <div className="overview-cards-grid">
        {MODULES.map((mod) => {
          const isFeatured = activeCard === mod.id;
          return (
            <div
              key={mod.id}
              className={`overview-card ${isFeatured ? 'featured' : ''}`}
              onClick={() => onNavigate(mod.id)}
              onMouseEnter={() => setActiveCard(mod.id)}
            >
              <div className="overview-card-icon">
                {mod.renderIcon()}
              </div>

              <div
                className="overview-card-title"
                style={{ whiteSpace: 'pre-line' }}
              >
                {mod.title}
              </div>

              <div className="overview-card-desc">
                {mod.subtitle}
              </div>

              <div className="overview-card-arrow">
                <ArrowRight size={20} strokeWidth={2.2} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
