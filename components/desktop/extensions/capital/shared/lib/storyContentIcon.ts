import { Zeus } from '@coopenomics/sdk';
import type { IStory } from 'app/extensions/capital/entities/Story/model';

/** Material-иконка типа содержимого артефакта */
export function storyContentIcon(story: IStory): string {
  if (story.content_format === Zeus.CapitalStoryContentFormat.BPMN) {
    return 'account_tree';
  }
  if (story.content_format === Zeus.CapitalStoryContentFormat.DRAWIO) {
    return 'device_hub';
  }
  if (story.content_format === Zeus.CapitalStoryContentFormat.MERMAID) {
    return 'schema';
  }
  return 'description';
}
