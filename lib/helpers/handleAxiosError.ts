import { AxiosError } from "axios"

export const handleAxiosError = (error: Error) => {
  if (error instanceof AxiosError) {
    console.error('Error fetching message:', error.message);
    console.error('Error response data:', error.response?.data);
    console.error('Error response status:', error.response?.status);
  }
}