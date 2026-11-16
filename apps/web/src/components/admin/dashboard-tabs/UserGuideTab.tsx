import React, { useMemo, useState } from 'react';
import { DashboardHeader } from '../DashboardHeader';
import { Button } from '../../Button';
import { adminGuideSections } from './adminGuideContent';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, Search, Sparkles } from 'lucide-react';

interface UserGuideTabProps {
  onNavigateToTab?: (tab: string) => void;
  onStartTour?: () => void;
}

export const UserGuideTab: React.FC<UserGuideTabProps> = ({ onNavigateToTab, onStartTour }) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>(['getting-started']);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return adminGuideSections;

    return adminGuideSections.filter((section) => {
      const haystack = [
        section.title,
        section.summary,
        ...section.steps.map((s) => s.text),
        ...(section.tips ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const toggleSection = (id: string) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const expandAll = () => setExpanded(filteredSections.map((s) => s.id));
  const collapseAll = () => setExpanded([]);

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Admin user guide"
        subtitle="Step-by-step help for managing inventory, staff, and sales"
        actionButton={
          onStartTour
            ? {
                label: 'Start setup walkthrough',
                onClick: onStartTour,
                icon: <Sparkles className="w-3.5 h-3.5" />,
              }
            : undefined
        }
        actionTourId="admin-guide-start"
      />

      {onStartTour && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">New here?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Take a short guided tour: branches → staff → warehouse → allocate stock.
            </p>
          </div>
          <Button size="sm" onClick={onStartTour} className="shrink-0 gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Start setup walkthrough
          </Button>
        </div>
      )}

      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guide…"
              className="input-modern pl-8 py-2 text-sm w-full"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse all
            </Button>
          </div>
        </div>

        {!query && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Jump to topic</p>
            <div className="flex flex-wrap gap-2">
              {adminGuideSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setExpanded((prev) => (prev.includes(section.id) ? prev : [...prev, section.id]));
                    document.getElementById(`guide-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-xs px-2.5 py-1 rounded-full bg-secondary text-foreground hover:bg-muted transition-colors"
                >
                  {section.icon} {section.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filteredSections.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No topics match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSections.map((section) => {
            const isOpen = expanded.includes(section.id);
            return (
              <div
                key={section.id}
                id={`guide-${section.id}`}
                className="glass-card overflow-hidden scroll-mt-4"
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/40 transition-colors"
                >
                  <span className="text-lg shrink-0" aria-hidden>
                    {section.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                      {section.tabId && onNavigateToTab && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToTab(section.tabId!);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              onNavigateToTab(section.tabId!);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                        >
                          Open in app
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{section.summary}</p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-border">
                    <ol className="mt-3 space-y-2 list-decimal list-inside">
                      {section.steps.map((step, i) => (
                        <li key={i} className="text-xs text-foreground leading-relaxed pl-1">
                          {step.text}
                        </li>
                      ))}
                    </ol>
                    {section.tips && section.tips.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
                        <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1.5">
                          Tips
                        </p>
                        <ul className="space-y-1">
                          {section.tips.map((tip, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                              <span className="text-primary shrink-0">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="glass-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">Recommended first-day workflow</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Branches → Products → Warehouse stock → Allocate → Add staff
          </p>
        </div>
        {onNavigateToTab && (
          <Button size="sm" variant="secondary" onClick={() => onNavigateToTab('overview')}>
            Back to dashboard
          </Button>
        )}
      </div>
    </div>
  );
};
