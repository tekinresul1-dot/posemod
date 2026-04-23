import { NextRequest } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnavailable } from '@/lib/database'
import { getErrorStatus, getPublicErrorMessage } from '@/lib/serverError'

const DEFAULT_POSE_DATA = {
  front: 'front facing, arms slightly away from body',
  back: 'back view, facing away from camera',
  right: 'right side profile view',
  left: 'left side profile view',
  angle45right: '45 degree angle from right side',
  angle45left: '45 degree angle from left side',
}

function buildPrompt(data: {
  gender?: string
  ethnicity?: string
  skinTone?: string
  hairColor?: string
  hairLength?: string
  eyeColor?: string
  height?: string
  size?: string
  ageRange?: string
  customPrompt?: string
}): string {
  const parts = [
    data.gender === 'Kadın' ? 'Female' : data.gender === 'Erkek' ? 'Male' : '',
    data.ethnicity ? data.ethnicity + ' appearance' : '',
    data.skinTone ? data.skinTone + ' skin tone' : '',
    data.hairColor && data.hairLength ? data.hairColor + ' ' + data.hairLength + ' hair' : data.hairColor ? data.hairColor + ' hair' : '',
    data.eyeColor ? data.eyeColor + ' eyes' : '',
    data.height ? data.height + ' tall' : '',
    data.size ? data.size + ' size body type' : '',
    data.ageRange ? data.ageRange + ' years old' : '',
    data.customPrompt || '',
    'professional fashion model, photorealistic, high quality',
  ].filter(Boolean)
  return parts.join(', ')
}

export async function GET(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const mannequins = await prisma.mannequin.findMany({
      where: { userId: user.id, isSystem: false },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({ mannequins })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return Response.json({ mannequins: [] })
    }
    return Response.json(
      { error: getPublicErrorMessage(error, 'Mankenler yüklenemedi') },
      { status: getErrorStatus(error) }
    )
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerSession(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      name?: string
      gender?: string
      ageRange?: string
      height?: string
      size?: string
      skinTone?: string
      hairColor?: string
      hairLength?: string
      eyeColor?: string
      ethnicity?: string
      customPrompt?: string
      referencePhotoUrl?: string
      createdFrom?: string
    }

    if (!body.name || !body.gender) {
      return Response.json({ error: 'Manken adı ve cinsiyet gerekli' }, { status: 400 })
    }

    const prompt = buildPrompt(body)

    const mannequin = await prisma.mannequin.create({
      data: {
        name: body.name,
        gender: body.gender,
        ageRange: body.ageRange ?? null,
        height: body.height ?? null,
        size: body.size ?? null,
        skinTone: body.skinTone ?? null,
        hairColor: body.hairColor ?? null,
        hairLength: body.hairLength ?? null,
        eyeColor: body.eyeColor ?? null,
        ethnicity: body.ethnicity ?? null,
        customPrompt: body.customPrompt ?? null,
        referencePhotoUrl: body.referencePhotoUrl ?? null,
        userId: user.id,
        prompt,
        poseData: DEFAULT_POSE_DATA,
        createdFrom: body.createdFrom ?? 'manual',
        isSystem: false,
        previewUrl: body.referencePhotoUrl ?? '',
      },
    })

    return Response.json({ mannequin })
  } catch (error) {
    return Response.json(
      { error: getPublicErrorMessage(error, 'Manken oluşturulamadı') },
      { status: getErrorStatus(error) }
    )
  }
}
