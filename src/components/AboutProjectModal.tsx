import React, { useEffect } from 'react';
import { X, GraduationCap, Users, Target, BookOpen } from 'lucide-react';
import { ACADEMIC_INFO } from '../data/academicInfo';

interface AboutProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutProjectModal: React.FC<AboutProjectModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const courseDetails = [
    { label: 'Sede', value: ACADEMIC_INFO.campus },
    { label: 'Cohorte', value: ACADEMIC_INFO.cohort },
    { label: 'Período', value: ACADEMIC_INFO.term },
    { label: 'Materia', value: ACADEMIC_INFO.course },
    { label: 'Profesora', value: ACADEMIC_INFO.professor },
  ];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-project-title"
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 text-sky-400">
            <GraduationCap className="w-5 h-5" />
            <h2 id="about-project-title" className="text-sm font-semibold text-white">
              Acerca del proyecto
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
          {/* Institutional header */}
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white p-2 shadow-md">
              <img
                src={ACADEMIC_INFO.logoUrl}
                alt="Logo de la Universidad Nacional Experimental de Guayana"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="space-y-0.5">
              {ACADEMIC_INFO.institutionalHeader.map((line, index) => (
                <p
                  key={line}
                  className={`uppercase tracking-wide ${
                    index === 1
                      ? 'text-sm font-bold text-white'
                      : 'text-[11px] text-slate-400'
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Project */}
          <section className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 space-y-2">
            <p className="text-[11px] font-mono uppercase text-emerald-400">
              Proyecto · {ACADEMIC_INFO.project.name}
            </p>
            <h3 className="text-base font-semibold text-white leading-snug">
              {ACADEMIC_INFO.project.title}
            </h3>
            <div className="flex gap-2 text-sm text-slate-300">
              <Target className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <p>
                <span className="font-semibold text-slate-200">Objetivo: </span>
                {ACADEMIC_INFO.project.objective}
              </p>
            </div>
          </section>

          {/* Course details */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-sky-400">
              <BookOpen className="w-3.5 h-3.5" />
              Datos académicos
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              {courseDetails.map(({ label, value }) => (
                <React.Fragment key={label}>
                  <dt className="text-slate-500 text-xs sm:text-sm">{label}</dt>
                  <dd className="text-slate-200 mb-1 sm:mb-0">{value}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>

          {/* Students */}
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-sky-400">
              <Users className="w-3.5 h-3.5" />
              Maestrantes
            </h3>
            <ul className="space-y-1 text-sm text-slate-200">
              {ACADEMIC_INFO.students.map((student) => (
                <li key={student} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  {student}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
