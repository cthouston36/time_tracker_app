"use client";

import { TWO_SERIES_PRODUCTION_CODES } from "@/lib/daily-report-templates";
import type { DailyReportAnswers } from "@/features/time-allocation/types";

export function DailyReportTwoSeriesFields({
  draft,
  onChange
}: {
  draft: DailyReportAnswers;
  onChange: (field: keyof DailyReportAnswers, value: string) => void;
}) {
  return (
    <>
      <section>
        <h3>Production Code Key</h3>
        <div className="production-code-key">
          {TWO_SERIES_PRODUCTION_CODES.map((productionCode) => (
            <div className="production-code-key-item" key={productionCode.code}>
              <strong>{productionCode.code}</strong>
              <span>{productionCode.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Work Completed</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-work-description">Detailed Description of Work Completed</label>
          <textarea
            id="daily-two-series-work-description"
            value={draft.workDescription}
            onChange={(event) => onChange("workDescription", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Equipment / Tools on Project</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-equipment-tools">Equipment / Tools on Project</label>
          <textarea
            id="daily-two-series-equipment-tools"
            value={draft.twoSeriesEquipmentTools}
            onChange={(event) => onChange("twoSeriesEquipmentTools", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Safety Issues & Concerns</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-safety">Safety Issues & Concerns</label>
          <textarea
            id="daily-two-series-safety"
            value={draft.twoSeriesSafetyIssues}
            onChange={(event) => onChange("twoSeriesSafetyIssues", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Problems / Delays</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-delays">Problems or Reasons for Delay</label>
          <textarea
            id="daily-two-series-delays"
            value={draft.twoSeriesDelayReasons}
            onChange={(event) => onChange("twoSeriesDelayReasons", event.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Deliveries</h3>
        <div className="field-group">
          <label htmlFor="daily-two-series-deliveries">Deliveries</label>
          <textarea
            id="daily-two-series-deliveries"
            value={draft.twoSeriesDeliveries}
            onChange={(event) => onChange("twoSeriesDeliveries", event.target.value)}
          />
        </div>
      </section>
    </>
  );
}
