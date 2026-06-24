import {
  annotationPilotPlanSchema,
  assignmentSchema,
  type AnnotationPilotPlan,
  type AssignmentRecord,
} from "@/data/schema";
import { tx } from "@/i18n";


export function buildPilotAssignments(
  rawPlan: AnnotationPilotPlan,
  taskType: "type" | "token",
  annotatorIds: string[],
): AssignmentRecord[] {
  const plan = annotationPilotPlanSchema.parse(rawPlan);
  const campaign = plan.campaigns[taskType];
  const annotators = [...new Set(annotatorIds)].sort();
  if (annotators.length < campaign.targetAnnotators) {
    throw new Error(tx("errors.minAnnotators", { count: campaign.targetAnnotators }));
  }
  const loads = new Map(annotators.map((uid) => [uid, 0]));
  const assignments: AssignmentRecord[] = [];
  for (const item of [...campaign.items].sort((a, b) => a.id.localeCompare(b.id))) {
    const selected = [...annotators]
      .sort((left, right) => (loads.get(left)! - loads.get(right)!) || left.localeCompare(right))
      .slice(0, campaign.targetAnnotators);
    for (const assigneeId of selected) {
      assignments.push(assignmentSchema.parse({
        id: `${campaign.id}-${item.id}-${assigneeId}`,
        campaignId: campaign.id,
        assigneeId,
        mweId: item.mweId,
        contextId: item.contextId,
        status: "assigned",
        itemSnapshotHash: item.itemSnapshotHash,
        itemSnapshot: item.itemSnapshot,
      }));
      loads.set(assigneeId, loads.get(assigneeId)! + 1);
    }
  }
  return assignments;
}

/** Single-curator prelabels are useful for guideline iteration but never count as gold. */
export function buildPreAnnotationAssignments(
  rawPlan: AnnotationPilotPlan,
  taskType: "type" | "token",
  assigneeId: string,
): AssignmentRecord[] {
  const plan = annotationPilotPlanSchema.parse(rawPlan);
  const campaign = plan.campaigns[taskType];
  const campaignId = `tr-prelabel-${taskType}-v1`;
  return [...campaign.items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => assignmentSchema.parse({
      id: `${campaignId}-${item.id}-${assigneeId}`,
      campaignId,
      assigneeId,
      mweId: item.mweId,
      contextId: item.contextId,
      status: "assigned",
      itemSnapshotHash: item.itemSnapshotHash,
      itemSnapshot: item.itemSnapshot,
    }));
}
