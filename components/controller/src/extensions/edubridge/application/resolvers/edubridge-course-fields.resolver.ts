import { Injectable } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { EduCatalogCourseDTO, EduCourseDTO } from '../dto/edu-course.dto';
import { EdubridgeCourseImagesService } from '../services/edubridge-course-images.service';

/**
 * Ленивая подписанная ссылка на обложку курса. DTO несёт только ключ bucket'а
 * (`image_record`), HMAC-ссылка считается здесь и только когда клиент запросил
 * `image_url`. Типы GraphQL `EduCatalogCourse` и `EduCourse` разные, поэтому
 * резолвер поля объявлен для каждого.
 */
async function resolveImageUrl(images: EdubridgeCourseImagesService, course: EduCatalogCourseDTO): Promise<string | null> {
  return course.image_record ? images.getReadUrl(course.image_record.bucket_key) : null;
}

@Resolver(() => EduCatalogCourseDTO)
@Injectable()
export class EdubridgeCatalogCourseFieldsResolver {
  constructor(private readonly images: EdubridgeCourseImagesService) {}

  @ResolveField('image_url', () => String, { nullable: true })
  imageUrl(@Parent() course: EduCatalogCourseDTO): Promise<string | null> {
    return resolveImageUrl(this.images, course);
  }
}

@Resolver(() => EduCourseDTO)
@Injectable()
export class EdubridgeCourseFieldsResolver {
  constructor(private readonly images: EdubridgeCourseImagesService) {}

  @ResolveField('image_url', () => String, { nullable: true })
  imageUrl(@Parent() course: EduCourseDTO): Promise<string | null> {
    return resolveImageUrl(this.images, course);
  }
}
