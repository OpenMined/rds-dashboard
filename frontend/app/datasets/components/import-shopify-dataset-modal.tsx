"use client"

import type React from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, FileDownIcon } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { AddShopifyDatasetFormSchema, datasetsApi } from "@/lib/api/datasets"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ApiError, FormFieldError } from "@/lib/api/errors"
import { Textarea } from "@/components/ui/textarea"

interface ImportShopifyDatasetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ImportShopifyDatasetModal({
  open,
  onOpenChange,
}: ImportShopifyDatasetModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<z.infer<typeof AddShopifyDatasetFormSchema>>({
    resolver: zodResolver(AddShopifyDatasetFormSchema),
    defaultValues: {
      name: "",
      url: "",
      pat: "",
      description: "",
    },
  })

  const { setError } = form

  const addShopifyDatasetMutation = useMutation({
    mutationFn: datasetsApi.addShopifyDataset,
    onError: (error) => {
      if (error instanceof FormFieldError) {
        //@ts-ignore: <- NOTE: maybe remove this in the future
        setError(error.loc, { message: error.message })
      }
      if (error instanceof ApiError) {
        toast({
          title: "Error",
          description: error.message,
        })
      }
    },
    onSuccess: () => {
      onOpenChange(false)
      form.reset()
      toast({
        title: "Success",
        description: "Added a new dataset from Shopify",
      })
      return queryClient.invalidateQueries({ queryKey: ["datasets"] })
    },
  })

  const { isPending } = addShopifyDatasetMutation

  function onSubmit(values: z.infer<typeof AddShopifyDatasetFormSchema>) {
    addShopifyDatasetMutation.mutate(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import data from your Shopify store</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
          >
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="relative w-full">
                    <FormLabel>Dataset Name *</FormLabel>
                    <FormMessage className="absolute top-1 right-0" />
                  </div>
                  <FormControl>
                    <Input placeholder="shopify_data" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Data from ..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="url"
              render={({ field }) => (
                <FormItem>
                  <div className="relative w-full">
                    <FormLabel>Shopify Store URL *</FormLabel>
                    <FormMessage className="absolute top-1 right-0" />
                  </div>
                  <FormControl>
                    <Input placeholder="https://your-store.com" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="pat"
              render={({ field }) => (
                <FormItem>
                  <div className="relative w-full">
                    <FormLabel>Access Token *</FormLabel>
                    <FormMessage className="absolute top-1 right-0" />
                  </div>
                  <FormControl>
                    <Input placeholder="shpat_123..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  form.reset()
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileDownIcon className="h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
