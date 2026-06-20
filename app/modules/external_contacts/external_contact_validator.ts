import vine from '@vinejs/vine'
import { CourierStructureType } from '#modules/courier/courier_enums'

export const createExternalContactValidator = vine.create(
  vine.object({
    name: vine.string().trim().maxLength(255),
    email: vine.string().email().trim().maxLength(255).optional(),
    phone: vine.string().trim().maxLength(255).optional(),
    structureType: vine.enum(Object.values(CourierStructureType)),
    idNumber: vine
      .string()
      .trim()
      .maxLength(255)
      .optional()
      .requiredWhen('structureType', '=', CourierStructureType.ENTREPRISE_PRIVEE),
    address: vine.string().trim().maxLength(500).optional(),
  })
)

export const updateExternalContactValidator = vine.create(
  vine.object({
    name: vine.string().trim().maxLength(255).optional(),
    email: vine.string().email().trim().maxLength(255).optional(),
    phone: vine.string().trim().maxLength(255).optional(),
    structureType: vine.enum(Object.values(CourierStructureType)).optional(),
    idNumber: vine
      .string()
      .trim()
      .maxLength(255)
      .optional()
      .requiredWhen('structureType', '=', CourierStructureType.ENTREPRISE_PRIVEE),
    address: vine.string().trim().maxLength(500).optional(),
  })
)



