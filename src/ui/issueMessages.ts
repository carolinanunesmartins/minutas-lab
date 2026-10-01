import type { TagType } from '../core/tags/types';
import type { FieldIssue, RuleIssue } from '../core/template/validate';
import { messages } from './messages.pt';

/** pt-PT "cause + how to fix" text for a field issue (never claims legal validity — only "formato"). */
export function fieldIssueMessage(issue: FieldIssue, type: TagType | undefined): string {
  if (issue.code === 'REQUIRED' || issue.code === 'REQUIRED_IF') return messages.fieldRequired;
  if (issue.severity === 'warning') return messages.fieldFormatInvalidWarning;
  return type !== undefined ? messages.fieldFormatByType[type] : messages.fieldFormatInvalid;
}

export function ruleIssueMessage(issue: RuleIssue): string {
  switch (issue.ruleType) {
    case 'sum_eq':
      return messages.ruleSumEq;
    case 'date_after':
      return messages.ruleDateAfter;
    case 'date_before':
      return messages.ruleDateBefore;
    case 'differs':
      return messages.ruleDiffers;
    default:
      return messages.fieldFormatInvalid;
  }
}
