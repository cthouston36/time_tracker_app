"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { IconLabel } from "@/components/icon-label";
import { mockProjects } from "@/lib/data/mock-projects";
import { todayInputValue } from "@/lib/date";
import type { AllocationEntry, CrewMember, Project } from "@/lib/procore/types";

type CrewByProject = Record<string, CrewMember[]>;

export function TimeAllocationWorkspace() {
  const [selectedProjectId, setSelectedProjectId] = useState(mockProjects[0]?.id ?? "");
  const [workDate, setWorkDate] = useState(todayInputValue());
  const [crewByProject, setCrewByProject] = useState<CrewByProject>({});
  const [crewName, setCrewName] = useState("");
  const [entries, setEntries] = useState<AllocationEntry[]>([]);
  const [selectedPayItemId, setSelectedPayItemId] = useState(mockProjects[0]?.payItems[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [quantity, setQuantity] = useState("");

  const selectedProject = useMemo(
    () => mockProjects.find((project) => project.id === selectedProjectId) ?? mockProjects[0],
    [selectedProjectId]
  );

  const crew = crewByProject[selectedProject?.id ?? ""] ?? [];

  useEffect(() => {
    const savedCrew = window.localStorage.getItem("crew-by-project");
    if (savedCrew) {
      setCrewByProject(JSON.parse(savedCrew) as CrewByProject);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("crew-by-project", JSON.stringify(crewByProject));
  }, [crewByProject]);

  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    setSelectedPayItemId(selectedProject.payItems[0]?.id ?? "");
  }, [selectedProject]);

  function addCrewMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = crewName.trim();

    if (!name || !selectedProject) {
      return;
    }

    const nextMember: CrewMember = {
      id: crypto.randomUUID(),
      name
    };

    setCrewByProject((current) => ({
      ...current,
      [selectedProject.id]: [...(current[selectedProject.id] ?? []), nextMember]
    }));
    setCrewName("");
  }

  function removeCrewMember(memberId: string) {
    if (!selectedProject) {
      return;
    }

    setCrewByProject((current) => ({
      ...current,
      [selectedProject.id]: (current[selectedProject.id] ?? []).filter((member) => member.id !== memberId)
    }));
  }

  function addAllocationEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProject || !selectedPayItemId) {
      return;
    }

    const payItem = selectedProject.payItems.find((item) => item.id === selectedPayItemId);
    const parsedHours = Number(hours);
    const parsedQuantity = Number(quantity);

    if (!payItem || parsedHours <= 0 || parsedQuantity < 0) {
      return;
    }

    setEntries((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        projectId: selectedProject.id,
        date: workDate,
        payItemId: payItem.id,
        payItemCode: payItem.code,
        payItemName: payItem.name,
        hours: parsedHours,
        quantityCompleted: parsedQuantity
      }
    ]);
    setHours("");
    setQuantity("");
  }

  function removeEntry(entryId: string) {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  }

  const visibleEntries = entries.filter(
    (entry) => entry.projectId === selectedProject?.id && entry.date === workDate
  );
  const totalHours = visibleEntries.reduce((total, entry) => total + entry.hours, 0);
  const totalQuantity = visibleEntries.reduce((total, entry) => total + entry.quantityCompleted, 0);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <h1>Crew Time Allocation</h1>
          <p>Assign field hours and installed quantities to project pay items.</p>
        </div>
        <IconLabel icon={CheckCircle2} text="Mock data active" />
      </header>

      <div className="workspace">
        <aside className="panel">
          <h2>Job Setup</h2>
          <div className="field-group">
            <label htmlFor="project">Job</label>
            <select
              id="project"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              {mockProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="work-date">Date</label>
            <input
              id="work-date"
              type="date"
              value={workDate}
              onChange={(event) => setWorkDate(event.target.value)}
            />
          </div>

          <form onSubmit={addCrewMember}>
            <div className="field-group">
              <label htmlFor="crew-name">Crew Member</label>
              <input
                id="crew-name"
                value={crewName}
                onChange={(event) => setCrewName(event.target.value)}
                placeholder="Name"
              />
            </div>
            <button className="secondary-button" type="submit">
              <Plus aria-hidden="true" size={18} />
              Add crew member
            </button>
          </form>

          <div aria-label="Crew members" className="crew-list" style={{ marginTop: 14 }}>
            {crew.length === 0 ? (
              <div className="empty-state">No crew members saved for this job.</div>
            ) : (
              crew.map((member) => (
                <div className="crew-row" key={member.id}>
                  <span>{member.name}</span>
                  <button
                    aria-label={`Remove ${member.name}`}
                    className="icon-button"
                    onClick={() => removeCrewMember(member.id)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="allocation-grid">
          <div className="summary-strip">
            <div className="metric">
              <span>Selected Job</span>
              <strong>{selectedProject?.name ?? "No job"}</strong>
            </div>
            <div className="metric">
              <span>Total Hours</span>
              <strong>{totalHours.toFixed(2)}</strong>
            </div>
            <div className="metric">
              <span>Quantity Completed</span>
              <strong>{totalQuantity.toFixed(2)}</strong>
            </div>
          </div>

          <div className="panel">
            <h2>Pay Item Entry</h2>
            <form className="entry-form" onSubmit={addAllocationEntry}>
              <div className="field-group">
                <label htmlFor="pay-item">Pay Item</label>
                <select
                  id="pay-item"
                  value={selectedPayItemId}
                  onChange={(event) => setSelectedPayItemId(event.target.value)}
                >
                  {selectedProject?.payItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="hours">Hours</label>
                <input
                  id="hours"
                  inputMode="decimal"
                  min="0"
                  step="0.25"
                  type="number"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                />
              </div>

              <div className="field-group">
                <label htmlFor="quantity">Quantity</label>
                <input
                  id="quantity"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>

              <button className="primary-button" type="submit">
                <CalendarDays aria-hidden="true" size={18} />
                Add entry
              </button>
            </form>
          </div>

          <div className="panel">
            <h2>Daily Allocation</h2>
            <div className="entry-list">
              {visibleEntries.length === 0 ? (
                <div className="empty-state">No pay item entries for this job and date.</div>
              ) : (
                visibleEntries.map((entry) => (
                  <div className="entry-row" key={entry.id}>
                    <span>
                      <strong>{entry.payItemCode}</strong> {entry.payItemName}
                    </span>
                    <span>{entry.hours.toFixed(2)} hrs</span>
                    <span>{entry.quantityCompleted.toFixed(2)} qty</span>
                    <button
                      aria-label={`Remove ${entry.payItemCode}`}
                      className="icon-button"
                      onClick={() => removeEntry(entry.id)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
