"use client";

import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import * as React from "react";

import { addMoveTask, toggleMoveTask } from "@/app/(app)/buyer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle, CardToolbar } from "@/components/ui/card";
import {
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { buildMovePlan, type MoveCategory, type PlannedMoveTask } from "@/lib/domain/move-in";
import { formatDate } from "@/lib/format";
import { cn, localId } from "@/lib/utils";
import type { MoveTask } from "@/types/database";

const CATEGORIES: MoveCategory[] = ["Home", "Moving", "Finance", "Services", "Admin", "Family"];

export function MovePlanner({
  records: initialRecords,
  forecastDate,
  contractDate,
  now,
}: {
  records: MoveTask[];
  forecastDate: string | null;
  contractDate: string | null;
  now: string;
}) {
  const { toast } = useToast();
  const [records, setRecords] = React.useState(initialRecords);
  const [anchor, setAnchor] = React.useState<"forecast" | "contract">(
    forecastDate ? "forecast" : "contract",
  );
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newCategory, setNewCategory] = React.useState<MoveCategory>("Home");
  const [newDays, setNewDays] = React.useState("14");
  const [, startTransition] = React.useTransition();

  const anchorDate =
    (anchor === "forecast" ? forecastDate : contractDate) ?? contractDate ?? now.slice(0, 10);
  const plan = React.useMemo(
    () => buildMovePlan({ anchorDate, asOf: new Date(now), records }),
    [anchorDate, now, records],
  );

  const toggle = (task: PlannedMoveTask) => {
    const done = task.state !== "done";
    const stamp = done ? new Date().toISOString() : null;
    const before = records;

    setRecords((current) => {
      if (task.isCustom)
        return current.map((r) => (r.id === task.key ? { ...r, done_at: stamp } : r));
      const existing = current.find((r) => r.template_key === task.key);
      if (existing) return current.map((r) => (r === existing ? { ...r, done_at: stamp } : r));
      return [
        ...current,
        {
          id: localId("local"),
          project_id: "",
          user_id: "",
          template_key: task.key,
          title: null,
          category: null,
          days_before: null,
          done_at: stamp,
          created_at: new Date().toISOString(),
        },
      ];
    });

    if (task.isCustom && task.key.startsWith("local_")) return;

    startTransition(async () => {
      const result = await toggleMoveTask(
        task.isCustom ? { taskId: task.key, done } : { templateKey: task.key, done },
      );
      if (!result.ok && !result.demo) {
        setRecords(before);
        toast({ tone: "error", title: "Not updated", description: result.message });
      }
    });
  };

  const add = () => {
    const title = newTitle.trim();
    if (title.length < 3) return;
    const record: MoveTask = {
      id: localId("local"),
      project_id: "",
      user_id: "",
      template_key: null,
      title,
      category: newCategory,
      days_before: Number(newDays),
      done_at: null,
      created_at: new Date().toISOString(),
    };
    setRecords((current) => [...current, record]);
    setNewTitle("");
    setAdding(false);

    startTransition(async () => {
      const result = await addMoveTask({
        title,
        category: newCategory,
        daysBefore: Number(newDays),
      });
      if (result.ok) toast({ tone: "success", title: "Task added" });
      else if (result.demo)
        toast({
          tone: "info",
          title: "Task added",
          description: "Shown here, but not saved — this is demo data.",
        });
      else {
        setRecords((current) => current.filter((r) => r.id !== record.id));
        toast({ tone: "error", title: "Not added", description: result.message });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <p className="ui-label text-ink-3 text-[10px]">Plan against</p>
            <div
              role="radiogroup"
              aria-label="Date to plan against"
              className="flex flex-wrap gap-1"
            >
              <Button
                role="radio"
                aria-checked={anchor === "forecast"}
                variant={anchor === "forecast" ? "subtle" : "ghost"}
                size="sm"
                disabled={!forecastDate}
                onClick={() => setAnchor("forecast")}
              >
                Forecast handover · {formatDate(forecastDate, "medium")}
              </Button>
              <Button
                role="radio"
                aria-checked={anchor === "contract"}
                variant={anchor === "contract" ? "subtle" : "ghost"}
                size="sm"
                onClick={() => setAnchor("contract")}
              >
                Contract date · {formatDate(contractDate, "medium")}
              </Button>
            </div>
            <p className="text-ink-3 max-w-xl text-[12px] leading-relaxed">
              {anchor === "forecast"
                ? "Dates follow the forecast, so if the build slips, your plan slips with it — you won't book removals for a house that isn't ready."
                : "Dates follow the contract. If the build is running late, some of these will come round before the house does."}
            </p>
          </div>

          <div className="min-w-56">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="ui-display text-ink text-[22px]">
                {plan.daysToAnchor > 0 ? `${plan.daysToAnchor} days` : "Handover"}
              </span>
              <span className="text-ink-3 text-[12px]">
                {plan.done} of {plan.total} done
              </span>
            </div>
            <Progress
              value={(plan.done / Math.max(1, plan.total)) * 100}
              label="Move-in plan progress"
            />
            {plan.overdue > 0 ? (
              <p className="text-critical-ink mt-1.5 flex items-center gap-1 text-[12px] font-medium">
                <AlertTriangle className="size-3.5" aria-hidden="true" />
                {plan.overdue} task{plan.overdue === 1 ? "" : "s"} past due
              </p>
            ) : plan.next ? (
              <p className="text-ink-3 mt-1.5 text-[12px]">
                Next: {plan.next.title} ({formatDate(plan.next.dueDate, "short")})
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {plan.windows.map((window) => (
        <section key={window.label} aria-labelledby={`window-${window.label}`}>
          <h2
            id={`window-${window.label}`}
            className="ui-label text-ink-3 border-line-strong mb-3 border-b pb-1.5 text-[10px]"
          >
            {window.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {window.tasks.map((task) => (
              <li key={task.key}>
                <TaskRow task={task} onToggle={() => toggle(task)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Card>
        <CardToolbar>
          <div>
            <CardTitle as="h2">Something else to remember?</CardTitle>
            <CardDescription>Add your own tasks — they move with the plan too.</CardDescription>
          </div>
          {!adding ? (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Add a task
            </Button>
          ) : null}
        </CardToolbar>
        {adding ? (
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                add();
              }}
              className="grid gap-3 sm:grid-cols-[1fr_150px_150px]"
            >
              <Field label="Task" htmlFor="move-task-title" required>
                <Input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="e.g. Book the piano movers"
                  maxLength={160}
                  required
                />
              </Field>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="move-task-category" className="ui-label text-ink-2 text-[10px]">
                  Category
                </label>
                <Select
                  value={newCategory}
                  onValueChange={(v) => setNewCategory(v as MoveCategory)}
                >
                  <SelectTrigger id="move-task-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label="Days before handover"
                htmlFor="move-task-days"
                hint="Negative for after."
              >
                <Input
                  type="number"
                  min={-120}
                  max={365}
                  value={newDays}
                  onChange={(event) => setNewDays(event.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2 sm:col-span-3">
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={newTitle.trim().length < 3}>
                  Add to plan
                </Button>
              </div>
            </form>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}

function TaskRow({ task, onToggle }: { task: PlannedMoveTask; onToggle: () => void }) {
  const id = `move-${task.key}`;
  const done = task.state === "done";

  return (
    <div
      className={cn(
        "ui-card flex items-start gap-3 p-3.5",
        task.state === "overdue" && "border-l-critical border-l-4",
        task.state === "due-soon" && "border-l-warning border-l-4",
      )}
    >
      <Checkbox id={id} checked={done} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={cn(
            "block cursor-pointer text-[13px] font-medium",
            done ? "text-ink-3 line-through" : "text-ink",
          )}
        >
          {task.title}
        </label>
        {task.detail && !done ? (
          <p className="text-ink-3 mt-0.5 text-[12px] leading-relaxed">{task.detail}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {done ? (
          <Badge tone="good" icon={CheckCircle2}>
            Done
          </Badge>
        ) : task.state === "overdue" ? (
          <Badge tone="critical" icon={AlertTriangle}>
            {Math.abs(task.daysUntil)}d overdue
          </Badge>
        ) : task.state === "due-soon" ? (
          <Badge tone="warning">{task.daysUntil === 0 ? "Today" : `In ${task.daysUntil}d`}</Badge>
        ) : (
          <span className="text-ink-3 tabular text-[11px]">
            {formatDate(task.dueDate, "short")}
          </span>
        )}
        <span className="text-ink-3 text-[10px]">{task.category}</span>
      </div>
    </div>
  );
}
