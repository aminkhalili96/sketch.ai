'use client';

import { useEffect, useState } from 'react';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { SketchUploader } from '@/components/SketchUploader';
import { ChatInterface } from '@/components/ChatInterface';
import { OutputTabs } from '@/components/OutputTabs';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Upload, MessageSquare } from 'lucide-react';

export default function Home() {
  const {
    currentProject,
    createProject,
    resetProject,
    error,
    clearError,
  } = useProjectStore();

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  useEffect(() => {
    if (!currentProject) {
      createProject('New Hardware Project', '');
    }
  }, [currentProject, createProject]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const toggleLeftPanel = () => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setLeftCollapsed(false);
    } else {
      panel.collapse();
      setLeftCollapsed(true);
    }
  };

  const toggleRightPanel = () => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setRightCollapsed(false);
    } else {
      panel.collapse();
      setRightCollapsed(true);
    }
  };

  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Compact Header */}
      <header className="flex-shrink-0 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight text-foreground">
            Sketch.ai
          </span>

          <div className="flex items-center gap-3">
            {currentProject?.analysis && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-accent rounded-full">
                Analysis complete
              </span>
            )}

            <Button
              onClick={resetProject}
              variant="outline"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground hover:bg-secondary border-border rounded-full h-7 px-3"
            >
              New Project
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard - Resizable Panels */}
      <div className="flex-1 overflow-hidden">
        <Group orientation="horizontal" className="h-full w-full">

          {/* LEFT - Upload Sketch */}
          <Panel
            id="upload-panel"
            panelRef={leftPanelRef}
            defaultSize="22%"
            minSize="16%"
            maxSize="35%"
            collapsible
            collapsedSize="4%"
            onResize={() => {
              setLeftCollapsed(leftPanelRef.current?.isCollapsed() ?? false);
            }}
          >
            <div className="h-full flex flex-col bg-card border-r border-border">
              {/* Panel Header with Collapse Button */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                {!leftCollapsed && (
                  <span className="text-sm font-medium text-foreground">Upload Sketch</span>
                )}
                <button
                  onClick={toggleLeftPanel}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                >
                  {leftCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-auto">
                {leftCollapsed ? (
                  <div className="flex flex-col items-center py-4 gap-2">
                    <Upload size={20} className="text-muted-foreground" />
                  </div>
                ) : (
                  <SketchUploader />
                )}
              </div>
            </div>
          </Panel>

          {/* Resize Handle */}
          <Separator className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

          {/* CENTER - Generated Outputs / 3D Viewer (Hero) */}
          <Panel id="output-panel" defaultSize="56%" minSize="35%">
            <div className="h-full bg-card overflow-hidden">
              <OutputTabs />
            </div>
          </Panel>

          {/* Resize Handle */}
          <Separator className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

          {/* RIGHT - Design Assistant / Chat */}
          <Panel
            id="chat-panel"
            panelRef={rightPanelRef}
            defaultSize="22%"
            minSize="16%"
            maxSize="40%"
            collapsible
            collapsedSize="4%"
            onResize={() => {
              setRightCollapsed(rightPanelRef.current?.isCollapsed() ?? false);
            }}
          >
            <div className="h-full flex flex-col bg-card border-l border-border">
              {/* Panel Header with Collapse Button */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <button
                  onClick={toggleRightPanel}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                >
                  {rightCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
                {!rightCollapsed && (
                  <span className="text-sm font-medium text-foreground">Design Assistant</span>
                )}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {rightCollapsed ? (
                  <div className="flex flex-col items-center py-4 gap-2">
                    <MessageSquare size={20} className="text-muted-foreground" />
                  </div>
                ) : (
                  <ChatInterface />
                )}
              </div>
            </div>
          </Panel>

        </Group>
      </div>
    </main>
  );
}
