'use client'
import React from 'react'
import {Button} from '@mui/material'
import { useRouter } from 'next/navigation'

const Homepage = () => {

  const router = useRouter();

  const handleChat = () => {
    router.push('/chat')
  }
  return (
    <div>
      Home

      <Button onClick = {handleChat}>Chat</Button>
    </div>
  )
}

export default Homepage
