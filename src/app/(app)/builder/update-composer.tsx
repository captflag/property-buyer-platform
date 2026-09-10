"use client";

import { Info, Send } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import type { Milestone } from "@/types/database";

import { postUpdate, type ActionResult } from "./actions";

const WEATHER_OPTIONS = ["Clear", "Partly cloudy", "Overcast", "Light rain", "Heavy rain", "Storm"];

/**
 * The form site staff use to post an update.
 *
 * It asks for crew size, hours and weather alongside the narrative because
 * those fields are what make an update verifiable later. Making them part of
 * the normal posting flow, rather than an optional extra screen, is the only
 * way they actually get filled in.
 */
export function UpdateComposer({
  milestones,
  projectSlug,
}: {
  milestones: Milestone[];
  /** The project the update is posted to -- the console can be switched between sites. */
  projectSlug: string;
}) {
  const [state, formAction, pending] = React.useActionState<ActionResult | null, FormData>(
    postUpdate,
    null,
  );
  const formRef = React.useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const [status, setStatus] = React.useState("in_progress");
  const [milestoneId, setMilestoneId] = React.useState("");
  const [weather, setWeather] = React.useState("Clear");

  // Reset and announce on success. The toast is the confirmation that
  // survives scrolling away from the form; the inline Alert is the one that
  // stays put for a reader who is still looking at it.
  React.useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    toast({
      tone: "success",
      title: "Update posted",
      description: "Everyone on the project has been notified.",
    });
  }, [state, toast]);

  const openMilestones = milestones.filter(
    (m) => m.status === "in_progress" || m.status === "blocked" || m.status === "not_started",
  );

  return (
    <Card>
      <CardToolbar>
        <div>
          <CardTitle as="h2">Post a site update</CardTitle>
          <CardDescription>
            Goes to everyone on the project immediately, with a notification.
          </CardDescription>
        </div>
      </CardToolbar>

      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          {/* Selects are controlled, so their values ride along in hidden
              inputs -- Radix Select does not render a native form control. */}
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="milestoneId" value={milestoneId} />
          <input type="hidden" name="weather" value={weather} />
          <input type="hidden" name="projectSlug" value={projectSlug} />

          <Field label="Title" htmlFor="title" required>
            <Input
              name="title"
              placeholder="e.g. Roof covering complete"
              maxLength={200}
              required
            />
          </Field>

          <Field
            label="What happened"
            htmlFor="body"
            required
            hint="Write it for the buyer. Say what was done, what it means, and what comes next."
          >
            <Textarea
              name="body"
              rows={5}
              placeholder="All tiling, ridge and hip work is finished and the building is now weather-tight…"
              maxLength={8000}
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="milestone-select" className="text-ink text-[13px] font-medium">
                Milestone
              </label>
              <Select value={milestoneId} onValueChange={setMilestoneId}>
                <SelectTrigger id="milestone-select" aria-label="Related milestone">
                  <SelectValue placeholder="Not linked to a milestone" />
                </SelectTrigger>
                <SelectContent>
                  {openMilestones.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="status-select" className="text-ink text-[13px] font-medium">
                Status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status-select" aria-label="Work status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="border-line rounded-[var(--radius-card)] border p-4">
            <legend className="text-ink-3 px-1.5 text-[11px] font-semibold tracking-wide uppercase">
              Site conditions
            </legend>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Crew on site" htmlFor="crewSize">
                <Input name="crewSize" type="number" min={0} max={500} placeholder="6" />
              </Field>

              <Field label="Hours worked" htmlFor="hoursWorked">
                <Input
                  name="hoursWorked"
                  type="number"
                  min={0}
                  max={9999}
                  step="0.5"
                  placeholder="48"
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="weather-select" className="text-ink text-[13px] font-medium">
                  Weather
                </label>
                <Select value={weather} onValueChange={setWeather}>
                  <SelectTrigger id="weather-select" aria-label="Weather on site">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEATHER_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Field label="Temperature (°C)" htmlFor="temperatureC">
                <Input name="temperatureC" type="number" min={-60} max={60} placeholder="24" />
              </Field>
            </div>

            <div className="mt-3 max-w-xs">
              <Field
                label="Progress added (%)"
                htmlFor="progressDelta"
                hint="How much this work moved the linked milestone forward."
              >
                <Input
                  name="progressDelta"
                  type="number"
                  min={-100}
                  max={100}
                  step="1"
                  placeholder="4"
                />
              </Field>
            </div>
          </fieldset>

          {state ? (
            <Alert
              tone={state.ok ? "good" : state.demo ? "warning" : "critical"}
              icon={state.demo ? Info : undefined}
            >
              {state.message}
            </Alert>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              <Send />
              {pending ? "Posting…" : "Post update"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
