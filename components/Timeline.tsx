"use client";

import React from "react";

export interface TimelineEvent {
  type: "divider" | "goal" | "sub" | "card";
  time: string;
  label?: string;
  player?: string;
  assist?: string;
  out?: string;
  in?: string;
  card?: "yellow" | "red";
  side: "left" | "right";
}

interface TimelineProps {
  events: TimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  return (
    <div className="timeline-container">
      <div className="timeline-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontSize: "17px", fontWeight: 500, color: "var(--kimi-color-text-primary)" }}>Timeline</span>
        <button 
          id="expandBtn" 
          style={{ 
            background: "var(--kimi-color-surface-muted)", 
            border: "none", 
            borderRadius: "8px", 
            width: "32px", 
            height: "32px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            cursor: "pointer", 
            color: "var(--kimi-color-text-secondary)", 
            transition: "background var(--t-fast) var(--ease-out)"
          }}
          onClick={() => {
            console.log("Showing full timeline");
          }}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>
      </div>

      <div id="timeline" className="space-y-0">
        {events.map((ev, i) => {
          if (ev.type === "divider") {
            return (
              <div key={i} className="divider">
                <div className="divider-line"></div>
                <span className="divider-text">{ev.label}</span>
                <div className="divider-line"></div>
              </div>
            );
          }

          const rowClassName = "event-row cursor-pointer hover:scale-105 transition-transform duration-150";
          
          // Build left content based on event type
          const leftContent = (
            <div className="event-left flex items-center justify-end flex-1 px-2 py-1" style={{ textAlign: "right", gap: "8px" }}>
              {ev.type === "goal" ? (
                <>
                  <div style={{ textAlign: "right" }}>
                    <div className="player-name" style={{ fontSize: "15px", fontWeight: 500, color: "var(--kimi-color-text-primary)", lineHeight: "1.3" }}>
                      {ev.player}
                    </div>
                    {ev.assist && <div className="player-sub" style={{ fontSize: "12px", color: "var(--kimi-color-text-tertiary)", lineHeight: "1.2" }}>
                      {ev.assist}
                    </div>}
                  </div>
                  <div className="icon-box" style={{ flexShrink: 0 }}>
                    <svg 
                      className="goal-icon" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="var(--kimi-color-text-primary)" 
                      strokeWidth="1.5"
                    >
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 6v6l4 2"/>
                    </svg>
                  </div>
                </>
              ) : ev.type === "card" ? (
                <>
                  <div style={{ textAlign: "right" }}>
                    <div className="player-name" style={{ fontSize: "15px", fontWeight: 500, color: "var(--kimi-color-text-primary)", lineHeight: "1.3" }}>
                      {ev.player}
                    </div>
                  </div>
                  <div className="icon-box" style={{ flexShrink: 0 }}>
                    <div className={`card-${ev.card}`} style={{ width: "16px", height: "20px", borderRadius: "3px" }}></div>
                  </div>
                </>
              ) : ev.type === "sub" ? (
                <>
                  <div style={{ textAlign: "right" }}>
                    <div className="player-name" style={{ fontSize: "15px", fontWeight: 500, color: "var(--kimi-color-text-primary)", lineHeight: "1.3" }}>
                      {ev.in}
                    </div>
                    <div className="player-sub" style={{ fontSize: "12px", color: "var(--kimi-color-text-tertiary)", lineHeight: "1.2" }}>
                      {ev.out}
                    </div>
                  </div>
                  <div className="icon-box" style={{ flexShrink: 0 }}>
                    <div className="sub-icon" style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <div className="sub-up" style={{ width: "0", height: "0", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "7px solid var(--kimi-color-positive)" }}></div>
                      <div className="sub-down" style={{ width: "0", height: "0", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid var(--kimi-color-danger)" }}></div>
                    </div>
                  </div>
                </>
              ) : (
                null
              )}
            </div>
          );

          // Build right content based on event type
          const rightContent = (
            <div className="event-right flex items-center justify-start flex-1 px-2 py-1" style={{ textAlign: "left", gap: "8px" }}>
              {ev.type === "sub" ? (
                <>
                  <div className="icon-box" style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div className="sub-icon" style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                      <div className="sub-up" style={{ width: "0", height: "0", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: "7px solid var(--kimi-color-positive)" }}></div>
                      <div className="sub-down" style={{ width: "0", height: "0", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "7px solid var(--kimi-color-danger)" }}></div>
                    </div>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div className="player-name" style={{ fontSize: "15px", fontWeight: 500, color: "var(--kimi-color-text-primary)", lineHeight: "1.3" }}>
                      {ev.in}
                    </div>
                    <div className="player-sub" style={{ fontSize: "12px", color: "var(--kimi-color-text-tertiary)", lineHeight: "1.2" }}>
                      {ev.out}
                    </div>
                  </div>
                </>
              ) : (
                null
              )}
            </div>
          );

          const centerHTML = (
            <div className="event-center flex items-center justify-center" style={{ position: "relative", zIndex: 2 }}>
              <div 
                className={`time-pill ${ev.type === "goal" ? "goal" : ""}`}
                style={{ 
                  background: "var(--kimi-color-surface-muted)", 
                  color: "var(--kimi-color-text-primary)", 
                  fontSize: "14px", 
                  fontWeight: 500, 
                  padding: "4px 10px", 
                  borderRadius: "10px", 
                  minWidth: "44px", 
                  textAlign: "center", 
                  fontVariantNumeric: "tabular-nums"
                }}
              >
                {ev.time}
              </div>
            </div>
          );

          return (
            <div key={ev.time + ev.type + (ev.player || "")} className={rowClassName}>
              <div className="event-left">{leftContent}</div>
              <div className="event-center">{centerHTML}</div>
              <div className="event-right">{rightContent}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}